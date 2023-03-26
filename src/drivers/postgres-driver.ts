import type * as PG from 'pg';
import * as TypeormDriver from 'typeorm/driver/postgres/PostgresDriver';
import { DataTypeDefaults } from 'typeorm/driver/types/DataTypeDefaults';

import { Column } from '../models/column';
import { Entity } from '../models/entity';
import { Index } from '../models/index';
import { RelationInternal } from '../models/relation-internal';
import { ConnectionOptions } from '../options/connection-options';
import { GenerationOptions } from '../options/generation-options';
import { logError } from '../utils';
import { AbstractDriver } from './abstract-driver';
import { getRelationsFromRelationTempInfo } from './db-utils';

interface PgTable {
  table_schema: string;
  table_name: string;
  db_name: string;
}

interface PgColumn {
  table_name: string;
  column_name: string;
  udt_name: string;
  column_default: string;
  is_nullable: string;
  data_type: string;
  character_maximum_length: number;
  numeric_precision: number;
  numeric_scale: number;
  isidentity: string; // SERIAL identity type
  is_identity: string; // recommended IDENTITY type for pg > 10
  isunique: string;
  enumvalues: string | null;
}

interface PgIndex {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: number;
  is_primary_key: number;
}

interface PgRelation {
  table_with_foreign_key: string;
  fk_partno: number;
  foreign_key_column: string;
  table_referenced: string;
  foreign_key_column_referenced: string;
  ondelete: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';
  onupdate: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';
  object_id: string;
}

export class PostgresDriver extends AbstractDriver {
  defaultValues: DataTypeDefaults = new TypeormDriver.PostgresDriver().dataTypeDefaults;
  protected readonly standardPort = 5432;
  protected readonly standardUser = 'postgres';
  protected readonly standardSchema = 'public';
  private pg: typeof PG;
  private connection: PG.Client | undefined = undefined;

  constructor() {
    super();
    try {
      // eslint-disable-next-line global-require
      this.pg = require('pg');
    } catch (err: any) {
      logError('', err);
      throw err;
    }
  }

  async connectToServer(connectionOptions: ConnectionOptions) {
    this.connection! = new this.pg.Client({
      database: connectionOptions.databaseNames[0],
      host: connectionOptions.host,
      password: connectionOptions.password,
      port: connectionOptions.port,
      ssl: connectionOptions.ssl,
      statement_timeout: 60 * 60 * 1000,
      user: connectionOptions.user,
    });

    try {
      await this.connection!.connect();
    } catch (err: any) {
      logError('Error connecting to Postgres Server', err);
    }
  }

  async disconnectFromServer() {
    if (this.connection) {
      try {
        await this.connection!.end();
      } catch (err: any) {
        logError('Error disconnecting from to Postgres Server', err);
      }
    }
  }

  async createDB(dbName: string) {
    await this.connection!.query(`CREATE DATABASE ${dbName}; `);
  }

  async dropDB(dbName: string) {
    await this.connection!.query(`DROP DATABASE ${dbName}; `);
  }

  async checkIfDBExists(dbName: string) {
    const { rowCount } = await this.connection!.query('SELECT datname FROM pg_database WHERE datname = $1', [dbName]);
    return rowCount > 0;
  }

  async getAllTables(schemas: string[], dbNames: string[]) {
    const dbTables: { rows: PgTable[] } = await this.connection!.query(
      `
SELECT table_schema,
       table_name,
       table_catalog AS db_name
FROM information_schema.TABLES
WHERE table_type='BASE TABLE'
      AND table_schema IN ($1)
      `,
      schemas,
    );

    const result: Entity[] = dbTables.rows.map(val => ({
      columns: [],
      indices: [],
      relations: [],
      relationIds: [],
      schema: val.table_schema,
      sqlName: val.table_name,
      tscName: val.table_name,
      fileName: val.table_name,
      database: dbNames.length > 1 ? val.db_name : '',
      fileImports: [],
    }));

    return result;
  }

  protected async getColumnsFromEntity(schemas: string[], dbNames: string[], entities: Entity[]) {
    const dbColumns: { rows: PgColumn[] } = await this.connection!.query(
      `
SELECT table_name,
       column_name,
       udt_name,
       column_default,
       is_nullable,
       data_type,
       character_maximum_length,
       numeric_precision,
       numeric_scale,
       case when column_default LIKE 'nextval%' then 'YES' else 'NO' end isidentity,
       is_identity,
       (SELECT count(*)
        FROM information_schema.table_constraints tc
             INNER JOIN information_schema.constraint_column_usage cu
                ON cu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
              and tc.table_name = c.table_name
              and cu.column_name = c.column_name
              and tc.table_schema=c.table_schema) isunique,
       (SELECT string_agg(enumlabel, ',')
        FROM pg_enum e
             INNER JOIN pg_type t ON t.oid = e.enumtypid
             INNER JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = table_schema AND t.typname = udt_name) enumValues
FROM information_schema.columns c
WHERE table_schema in ($1)
ORDER BY ordinal_position
    `,
      schemas,
    );

    entities.forEach(entity => {
      dbColumns.rows
        .filter(filterVal => filterVal.table_name === entity.tscName)
        .forEach(column => {
          const tscName = column.column_name;
          const options: Column['options'] = {
            name: column.column_name,
          };
          if (column.is_nullable === 'YES') {
            options.nullable = true;
          }
          if (column.isunique === '1') {
            options.unique = true;
          }

          const generated = column.isidentity === 'YES' || column.is_identity === 'YES' ? true : undefined;
          const defaultValue = generated
            ? undefined
            : this.returnDefaultValueFunction(column.column_default, column.data_type);

          const columnTypes = this.matchColumnTypes(column.data_type, column.udt_name, column.enumvalues);
          if (columnTypes.tsType === 'NonNullable<unknown>') {
            if (column.data_type === 'USER-DEFINED' || column.data_type === 'ARRAY') {
              logError(`Unknown ${column.data_type} column type: ${column.udt_name} \
table name: ${column.table_name}, column name: ${column.column_name}`);
            } else {
              logError(`Unknown column type: ${column.data_type} \
table name: ${column.table_name}, column name: ${column.column_name}`);
            }
            return;
          }

          const columnType = columnTypes.sqlType;
          let tscType = columnTypes.tsType;
          if (columnTypes.isArray) {
            options.array = true;
          }
          if (columnTypes.enumValues.length > 0) {
            options.enum = columnTypes.enumValues;
          }
          if (options.array) {
            tscType = tscType
              .split('|')
              .map(x => `${x.replace('|', '').trim()}[]`)
              .join(' | ');
          }

          if (this.columnTypesWithPrecision.some(v => v === columnType)) {
            if (column.numeric_precision !== null) {
              options.precision = column.numeric_precision;
            }
            if (column.numeric_scale !== null) {
              options.scale = column.numeric_scale;
            }
          }
          if (this.columnTypesWithLength.some(v => v === columnType)) {
            options.length = column.character_maximum_length > 0 ? column.character_maximum_length : undefined;
          }
          if (this.columnTypesWithWidth.some(v => v === columnType)) {
            options.width = column.character_maximum_length > 0 ? column.character_maximum_length : undefined;
          }

          entity.columns.push({
            generated,
            type: columnType,
            default: defaultValue,
            options,
            tscName,
            tscType,
          });
        });
    });

    return entities;
  }

  private matchColumnTypes(dataType: string, udtName: string, enumValues: string | null) {
    let result: {
      tsType: Column['tscType'];
      sqlType: string;
      isArray: boolean;
      enumValues: string[];
    } = {
      tsType: '',
      sqlType: dataType,
      isArray: false,
      enumValues: [],
    };

    switch (dataType) {
      case 'int2':
        result.tsType = 'number';
        break;
      case 'int4':
        result.tsType = 'number';
        break;
      case 'int8':
        result.tsType = 'string';
        break;
      case 'smallint':
        result.tsType = 'number';
        break;
      case 'integer':
        result.tsType = 'number';
        break;
      case 'bigint':
        result.tsType = 'string';
        break;
      case 'decimal':
        result.tsType = 'string';
        break;
      case 'numeric':
        result.tsType = 'string';
        break;
      case 'real':
        result.tsType = 'number';
        break;
      case 'float':
        result.tsType = 'number';
        break;
      case 'float4':
        result.tsType = 'number';
        break;
      case 'float8':
        result.tsType = 'number';
        break;
      case 'double precision':
        result.tsType = 'number';
        break;
      case 'money':
        result.tsType = 'string';
        break;
      case 'character varying':
        result.tsType = 'string';
        break;
      case 'varchar':
        result.tsType = 'string';
        break;
      case 'character':
        result.tsType = 'string';
        break;
      case 'char':
        result.tsType = 'string';
        break;
      case 'bpchar':
        result.sqlType = 'char';
        result.tsType = 'string';
        break;
      case 'text':
        result.tsType = 'string';
        break;
      case 'citext':
        result.tsType = 'string';
        break;
      case 'hstore':
        result.tsType = 'string';
        break;
      case 'bytea':
        result.tsType = 'Buffer';
        break;
      case 'bit':
        result.tsType = 'string';
        break;
      case 'varbit':
        result.tsType = 'string';
        break;
      case 'bit varying':
        result.tsType = 'string';
        break;
      case 'timetz':
        result.tsType = 'string';
        break;
      case 'timestamptz':
        result.tsType = 'Date';
        break;
      case 'timestamp':
        result.tsType = 'string';
        break;
      case 'timestamp without time zone':
        result.tsType = 'Date';
        break;
      case 'timestamp with time zone':
        result.tsType = 'Date';
        break;
      case 'date':
        result.tsType = 'string';
        break;
      case 'time':
        result.tsType = 'string';
        break;
      case 'time without time zone':
        result.tsType = 'string';
        break;
      case 'time with time zone':
        result.tsType = 'string';
        break;
      case 'interval':
        result.tsType = 'any';
        break;
      case 'bool':
        result.tsType = 'boolean';
        break;
      case 'boolean':
        result.tsType = 'boolean';
        break;
      case 'point':
        result.tsType = 'string | object';
        break;
      case 'line':
        result.tsType = 'string';
        break;
      case 'lseg':
        result.tsType = 'string | string[]';
        break;
      case 'box':
        result.tsType = 'string | object';
        break;
      case 'path':
        result.tsType = 'string';
        break;
      case 'polygon':
        result.tsType = 'string';
        break;
      case 'circle':
        result.tsType = 'string | object';
        break;
      case 'cidr':
        result.tsType = 'string';
        break;
      case 'inet':
        result.tsType = 'string';
        break;
      case 'macaddr':
        result.tsType = 'string';
        break;
      case 'tsvector':
        result.tsType = 'string';
        break;
      case 'tsquery':
        result.tsType = 'string';
        break;
      case 'uuid':
        result.tsType = 'string';
        break;
      case 'xml':
        result.tsType = 'string';
        break;
      case 'json':
        result.tsType = 'object';
        break;
      case 'jsonb':
        result.tsType = 'object';
        break;
      case 'int4range':
        result.tsType = 'string';
        break;
      case 'int8range':
        result.tsType = 'string';
        break;
      case 'numrange':
        result.tsType = 'string';
        break;
      case 'tsrange':
        result.tsType = 'string';
        break;
      case 'tstzrange':
        result.tsType = 'string';
        break;
      case 'daterange':
        result.tsType = 'string';
        break;
      case 'ARRAY':
        result = this.matchColumnTypes(udtName.substring(1), udtName, enumValues);
        result.isArray = true;
        break;
      case 'USER-DEFINED':
        result.tsType = 'string';
        switch (udtName) {
          case 'citext':
          case 'hstore':
          case 'geography':
          case 'geometry':
          case 'ltree':
            result.sqlType = udtName;
            break;
          default:
            if (enumValues) {
              result.tsType = `"${enumValues.split(',').join('" | "')}"` as never as string;
              result.sqlType = 'enum';
              result.enumValues = enumValues.split(',');
            }
            break;
        }
        break;
      default:
        result.tsType = 'NonNullable<unknown>';
        break;
    }

    return result;
  }

  protected async getIndexesFromEntity(schemas: string[], dbNames: string[], entities: Entity[]) {
    const dbIndexes: { rows: PgIndex[] } = await this.connection!.query(
      `
SELECT c.relname AS table_name,
       i.relname AS index_name,
       f.attname AS column_name,
       CASE
         WHEN ix.indisunique = true THEN 1
         ELSE 0
       END AS is_unique,
       CASE
         WHEN ix.indisprimary='true' THEN 1
         ELSE 0
       END AS is_primary_key
FROM pg_attribute f
     JOIN pg_class c ON c.oid = f.attrelid
     JOIN pg_type t ON t.oid = f.atttypid
     LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
     LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_index AS ix ON f.attnum = ANY(ix.indkey) AND c.oid = f.attrelid AND c.oid = ix.indrelid
     LEFT JOIN pg_class AS i ON ix.indexrelid = i.oid
WHERE c.relkind = 'r'::char
      AND n.nspname IN ($1)
      AND f.attnum > 0
      AND i.oid <> 0
ORDER BY c.relname,f.attname
      `,
      schemas,
    );

    entities.forEach(entity => {
      const entityIndices = dbIndexes.rows.filter(filterVal => filterVal.table_name === entity.tscName);
      const indexNames = new Set(entityIndices.map(v => v.index_name));
      indexNames.forEach(indexName => {
        const records = entityIndices.filter(v => v.index_name === indexName);
        const indexInfo: Index = {
          columns: [],
          options: {},
          name: records[0].index_name,
        };
        if (records[0].is_primary_key === 1) {
          indexInfo.primary = true;
        }
        if (records[0].is_unique === 1) {
          indexInfo.options.unique = true;
        }
        records.forEach(record => {
          indexInfo.columns.push(record.column_name);
        });
        entity.indices.push(indexInfo);
      });
    });

    return entities;
  }

  protected async getRelations(
    schemas: string[],
    dbNames: string[],
    generationOptions: GenerationOptions,
    entities: Entity[],
  ) {
    const dbRelations: { rows: PgRelation[] } = await this.connection!.query(
      `
SELECT DISTINCT con.relname AS table_with_foreign_key,
       att.attnum AS fk_partno,
       att2.attname AS foreign_key_column,
       cl.relname AS table_referenced,
       att.attname AS foreign_key_column_referenced,
       delete_rule AS ondelete,
       update_rule AS onupdate,
       concat(con.conname,con.conrelid,con.confrelid) AS object_id
FROM (
    SELECT unnest(con1.conkey) AS parent,
           unnest(con1.confkey) AS child,
           con1.confrelid,
           con1.conrelid,
           cl_1.relname,
           con1.conname,
           nspname
    FROM pg_class cl_1,
         pg_namespace ns,
         pg_constraint con1
    WHERE con1.contype = 'f'::"char"
          AND cl_1.relnamespace = ns.oid
          AND con1.conrelid = cl_1.oid
          and nspname in ($1)
) con,
  pg_attribute att,
  pg_class cl,
  pg_attribute att2,
  information_schema.referential_constraints rc
WHERE att.attrelid = con.confrelid
      AND att.attnum = con.child
      AND cl.oid = con.confrelid
      AND att2.attrelid = con.conrelid
      AND att2.attnum = con.parent
      AND rc.constraint_name = con.conname
      AND constraint_catalog = current_database()
      AND rc.constraint_schema = nspname
    `,
      schemas,
    );

    const relationsTemp: RelationInternal[] = [] as RelationInternal[];
    const relationKeys = new Set(dbRelations.rows.map(v => v.object_id));

    relationKeys.forEach(relationId => {
      const rows = dbRelations.rows.filter(v => v.object_id === relationId);
      const ownerTable = entities.find(v => v.sqlName === rows[0].table_with_foreign_key);
      const relatedTable = entities.find(v => v.sqlName === rows[0].table_referenced);
      if (!ownerTable || !relatedTable) {
        logError(`Relation between tables ${rows[0].table_with_foreign_key} \
and ${rows[0].table_referenced} wasn't found in entity model`);
        return;
      }

      const internal: RelationInternal = {
        ownerColumns: [],
        relatedColumns: [],
        ownerTable,
        relatedTable,
      };
      if (rows[0].ondelete !== 'NO ACTION') {
        internal.onDelete = rows[0].ondelete;
      }
      if (rows[0].onupdate !== 'NO ACTION') {
        internal.onUpdate = rows[0].onupdate;
      }
      rows.forEach(row => {
        internal.ownerColumns.push(row.foreign_key_column);
        internal.relatedColumns.push(row.foreign_key_column_referenced);
      });
      relationsTemp.push(internal);
    });

    return getRelationsFromRelationTempInfo(generationOptions, relationsTemp, entities);
  }

  private returnDefaultValueFunction(defVal: string | null, dataType: string) {
    let defaultValue = defVal;
    if (!defaultValue) {
      return undefined;
    }
    defaultValue = defaultValue.replace(/'::[\w ]*/, "'");

    if (['json', 'jsonb'].some(x => x === dataType)) {
      return `${defaultValue.slice(1, defaultValue.length - 1)}`;
    }
    return `() => "${defaultValue}"`;
  }
}
