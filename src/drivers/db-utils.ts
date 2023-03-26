import { JoinColumnOptions, RelationOptions } from 'typeorm';

import { Column } from '../models/column';
import { Entity } from '../models/entity';
import { Relation } from '../models/relation';
import { RelationInternal } from '../models/relation-internal';
import { GenerationOptions } from '../options/generation-options';
import { findNameForNewField, logWarn } from '../utils';

export function findManyToManyRelations(entities: Entity[]) {
  let result = entities;
  const manyToManyEntities = result.filter(
    entity =>
      entity.relations.length === 2 &&
      entity.relations.every(v => v.joinColumnOptions && v.relationType !== 'ManyToMany') &&
      entity.relations[0].relatedTable !== entity.relations[1].relatedTable &&
      entity.relations[0].joinColumnOptions!.length === entity.relations[1].joinColumnOptions!.length &&
      entity.columns.length === entity.columns.filter(c => c.primary).length &&
      entity.columns
        .map(v => v.tscName)
        .filter(
          v =>
            !entity.relations[0].joinColumnOptions!.map(x => x.name).some(jc => jc === v) &&
            !entity.relations[1].joinColumnOptions!.map(x => x.name).some(jc => jc === v),
        ).length === 0,
  );

  manyToManyEntities.forEach(junctionEntity => {
    const firstEntity = entities.find(v => v.tscName === junctionEntity.relations[0].relatedTable)!;
    const secondEntity = entities.find(v => v.tscName === junctionEntity.relations[1].relatedTable)!;

    const firstRelation = firstEntity.relations.find(v => v.relatedTable === junctionEntity.tscName)!;
    const secondRelation = secondEntity.relations.find(v => v.relatedTable === junctionEntity.tscName)!;

    firstRelation.relationType = 'ManyToMany';
    secondRelation.relationType = 'ManyToMany';
    firstRelation.relatedTable = secondEntity.tscName;
    secondRelation.relatedTable = firstEntity.tscName;

    firstRelation.fieldName = findNameForNewField(secondEntity.tscName, firstEntity);
    secondRelation.fieldName = findNameForNewField(firstEntity.tscName, secondEntity);
    firstRelation.relatedField = secondRelation.fieldName;
    secondRelation.relatedField = firstRelation.fieldName;

    firstRelation.joinTableOptions = {
      name: junctionEntity.sqlName,
      joinColumns: junctionEntity.relations[0].joinColumnOptions!.map((v, i) => {
        return {
          referencedColumnName: v.referencedColumnName,
          name: junctionEntity.relations[0].joinColumnOptions![i].name,
        };
      }),
      inverseJoinColumns: junctionEntity.relations[1].joinColumnOptions!.map((v, i) => {
        return {
          referencedColumnName: v.referencedColumnName,
          name: junctionEntity.relations[1].joinColumnOptions![i].name,
        };
      }),
    };
    if (junctionEntity.database) {
      firstRelation.joinTableOptions.database = junctionEntity.database;
    }
    if (junctionEntity.schema) {
      firstRelation.joinTableOptions.schema = junctionEntity.schema;
    }

    firstRelation.relationOptions = undefined;
    secondRelation.relationOptions = undefined;
    firstRelation.joinColumnOptions = undefined;
    secondRelation.joinColumnOptions = undefined;
    result = result.filter(ent => {
      return ent.tscName !== junctionEntity.tscName;
    });
  });

  return result;
}

export function getRelationsFromRelationTempInfo(
  generationOptions: GenerationOptions,
  relationsTemp: RelationInternal[],
  entities: Entity[],
) {
  relationsTemp.forEach(relationTmp => {
    const ownerEntity = entities.find(entity => entity.tscName === relationTmp.ownerTable.tscName);
    if (!ownerEntity) {
      logWarn(`Relation between tables ${relationTmp.ownerTable.sqlName} and ${relationTmp.relatedTable.sqlName}
didn't found entity model ${relationTmp.ownerTable.sqlName}`);
      return;
    }

    const referencedEntity = entities.find(entity => entity.tscName === relationTmp.relatedTable.tscName);
    if (!referencedEntity) {
      logWarn(`Relation between tables ${relationTmp.ownerTable.sqlName} and ${relationTmp.relatedTable.sqlName}
didn't found entity model ${relationTmp.relatedTable.sqlName}`);
      return;
    }

    const ownerColumns: Column[] = [];
    const relatedColumns: Column[] = [];
    for (let relationColumnIndex = 0; relationColumnIndex < relationTmp.ownerColumns.length; relationColumnIndex++) {
      const ownerColumn = ownerEntity.columns.find(
        column => column.tscName === relationTmp.ownerColumns[relationColumnIndex],
      );
      if (!ownerColumn) {
        logWarn(`Relation between tables ${relationTmp.ownerTable.sqlName} and ${relationTmp.relatedTable.sqlName}
didn't found entity column ${relationTmp.ownerTable.sqlName}.${ownerColumn}`);
        return;
      }

      const relatedColumn = referencedEntity.columns.find(
        column => column.tscName === relationTmp.relatedColumns[relationColumnIndex],
      );
      if (!relatedColumn) {
        logWarn(`Relation between tables ${relationTmp.ownerTable.sqlName} and ${relationTmp.relatedTable.sqlName}
didn't found entity column ${relationTmp.relatedTable.sqlName}.${relatedColumn}`);
        return;
      }

      ownerColumns.push(ownerColumn);
      relatedColumns.push(relatedColumn);
    }

    let isOneToMany = false;
    const index = ownerEntity.indices.find(
      index =>
        index.options.unique &&
        index.columns.length === ownerColumns.length &&
        ownerColumns.every(ownerColumn => index.columns.some(col => col === ownerColumn.tscName)),
    );
    isOneToMany = !index;

    ownerColumns.forEach(column => {
      column.isUsedInRelationAsOwner = true;
    });
    relatedColumns.forEach(column => {
      column.isUsedInRelationAsReferenced = true;
    });

    const fieldName =
      ownerColumns.length === 1
        ? findNameForNewField(ownerColumns[0].tscName, ownerEntity)
        : findNameForNewField(relationTmp.relatedTable.tscName, ownerEntity);

    const relationOptions: RelationOptions = {
      onDelete: relationTmp.onDelete,
      onUpdate: relationTmp.onUpdate,
    };

    const ownerRelation: Relation = {
      fieldName,
      relatedField: findNameForNewField(relationTmp.ownerTable.tscName, relationTmp.relatedTable),
      joinColumnOptions: relationTmp.ownerColumns.map((v, idx) => {
        const retVal: Required<JoinColumnOptions> = {
          name: v,
          referencedColumnName: relationTmp.relatedColumns[idx],
          foreignKeyConstraintName: '',
        };
        return retVal;
      }),
      relatedTable: relationTmp.relatedTable.tscName,
      relationType: isOneToMany ? 'ManyToOne' : 'OneToOne',
    };
    if (JSON.stringify(relationOptions) !== '{}') {
      ownerRelation.relationOptions = relationOptions;
    }

    const relatedRelation: Relation = {
      fieldName: ownerRelation.relatedField,
      relatedField: ownerRelation.fieldName,
      relatedTable: relationTmp.ownerTable.tscName,
      relationType: isOneToMany ? 'OneToMany' : 'OneToOne',
    };
    ownerEntity.relations.push(ownerRelation);
    relationTmp.relatedTable.relations.push(relatedRelation);

    if (generationOptions.relationIds && ownerColumns.length === 1) {
      let relationIdFieldName = '';
      relationIdFieldName = findNameForNewField(ownerColumns[0].tscName, ownerEntity);

      let fieldType = '';
      if (ownerRelation.relationType === 'OneToMany') {
        fieldType = `${ownerColumns[0].tscType}[]`;
      } else {
        fieldType = ownerColumns[0].tscType;
        if (ownerColumns[0].options.nullable) {
          fieldType += ' | null';
        }
      }

      ownerEntity.relationIds.push({
        fieldName: relationIdFieldName,
        fieldType,
        relationField: ownerRelation.fieldName,
      });
      // TODO: RelationId on ManyToMany
    }
  });
  return entities;
}

export function findPrimaryColumnsFromIndexes(entities: Entity[]) {
  entities.forEach(entity => {
    const primaryIndex = entity.indices.find(v => v.primary);
    entity.columns
      .filter(column => primaryIndex && primaryIndex.columns.some(index => index === column.tscName))
      .forEach(column => {
        column.primary = true;
        if (column.options.unique) {
          delete column.options.unique;
        }
      });
    const hasNoPK = entity.columns.some(v => !!v.primary);
    if (!hasNoPK) {
      logWarn(`Table ${entity.tscName} has no PK`);
    }
  });
}
