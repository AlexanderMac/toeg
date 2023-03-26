import { WithLengthColumnType, WithPrecisionColumnType, WithWidthColumnType } from 'typeorm/driver/types/ColumnTypes';
import { DataTypeDefaults } from 'typeorm/driver/types/DataTypeDefaults';

import { Entity } from '../models/entity';
import { ConnectionOptions } from '../options/connection-options';
import { GenerationOptions } from '../options/generation-options';
import { findManyToManyRelations, findPrimaryColumnsFromIndexes } from './db-utils';

export abstract class AbstractDriver {
  abstract defaultValues: DataTypeDefaults;
  protected abstract standardPort: number;
  protected abstract standardSchema: string;
  protected abstract standardUser: string;
  protected columnTypesWithWidth: WithWidthColumnType[] = ['tinyint', 'smallint', 'mediumint', 'int', 'bigint'];
  protected columnTypesWithPrecision: WithPrecisionColumnType[] = [
    'float',
    'double',
    'dec',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'number',
    'datetime',
    'datetime2',
    'datetimeoffset',
    'time',
    'time with time zone',
    'time without time zone',
    'timestamp',
    'timestamp without time zone',
    'timestamp with time zone',
    'timestamp with local time zone',
  ];
  protected columnTypesWithLength: WithLengthColumnType[] = [
    'character varying',
    'varying character',
    'nvarchar',
    'character',
    'native character',
    'varchar',
    'char',
    'nchar',
    'varchar2',
    'nvarchar2',
    'raw',
    'binary',
    'varbinary',
  ];

  abstract connectToServer(connectionOptions: ConnectionOptions): Promise<void>;

  abstract disconnectFromServer(): Promise<void>;

  abstract createDB(dbName: string): Promise<void>;

  abstract dropDB(dbName: string): Promise<void>;

  abstract checkIfDBExists(dbName: string): Promise<boolean>;

  async getDataFromServer(connectionOptions: ConnectionOptions, generationOptions: GenerationOptions) {
    await this.connectToServer(connectionOptions);

    let entities = await this.getAllTables(connectionOptions.schemaNames, connectionOptions.databaseNames);
    await this.getColumnsFromEntity(connectionOptions.schemaNames, connectionOptions.databaseNames, entities);
    await this.getIndexesFromEntity(connectionOptions.schemaNames, connectionOptions.databaseNames, entities);

    findPrimaryColumnsFromIndexes(entities);
    entities = await this.getRelations(
      connectionOptions.schemaNames,
      connectionOptions.databaseNames,
      generationOptions,
      entities,
    );
    await this.disconnectFromServer();

    entities = findManyToManyRelations(entities);

    return entities;
  }

  protected abstract getAllTables(schemas: string[], dbNames: string[]): Promise<Entity[]>;

  protected abstract getColumnsFromEntity(schemas: string[], dbNames: string[], entities: Entity[]): Promise<Entity[]>;

  protected abstract getIndexesFromEntity(schemas: string[], dbNames: string[], entities: Entity[]): Promise<Entity[]>;

  protected abstract getRelations(
    schemas: string[],
    dbNames: string[],
    generationOptions: GenerationOptions,
    entities: Entity[],
  ): Promise<Entity[]>;
}
