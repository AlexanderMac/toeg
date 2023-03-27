import { DataTypeDefaults } from 'typeorm/driver/types/DataTypeDefaults';
import { DefaultNamingStrategy } from 'typeorm/naming-strategy/DefaultNamingStrategy';

import { Entity } from '../models/entity';
import { GenerationOptions } from '../options/generation-options';
import { findNameForNewField } from '../utils';
import * as namingStrategy from './naming-strategy';

export function customizeEntities(
  generationOptions: GenerationOptions,
  defaultValues: DataTypeDefaults,
  entities: Entity[],
) {
  removeIndicesGeneratedByTypeorm(entities);
  if (!generationOptions.skipRelations) {
    removeColumnsInRelation(entities);
  }
  removeColumnDefaultProperties(entities, defaultValues);
  if (generationOptions.skipIndices) {
    removeIndices(entities);
  }
  if (generationOptions.skipRelations) {
    removeRelations(entities);
  }

  changeRelationNames(entities, generationOptions.pluralizeNames);
  changeRelationIdNames(entities, generationOptions.pluralizeNames);
  changeEntityNames(entities);
  changeColumnNames(entities);
  changeFileNames(entities);

  addImportsAndGenerationOptions(entities, generationOptions);
}

function removeIndicesGeneratedByTypeorm(entities: Entity[]) {
  const namingStrategy = new DefaultNamingStrategy();

  entities.forEach(entity => {
    entity.indices = entity.indices.filter(v => !(v.primary && v.name === 'PRIMARY'));
    const primaryColumns = entity.columns.filter(v => v.primary).map(v => v.tscName);
    entity.indices = entity.indices.filter(
      v => !(v.primary && v.name === namingStrategy.primaryKeyName(entity.tscName, primaryColumns)),
    );
    entity.relations
      .filter(v => v.joinColumnOptions)
      .forEach(rel => {
        const columnNames = rel.joinColumnOptions!.map(v => v.name);
        const idxName = namingStrategy.relationConstraintName(entity.tscName, columnNames);
        const fkName = namingStrategy.foreignKeyName(entity.tscName, columnNames);
        entity.indices = entity.indices.filter(v => v.name !== idxName && v.name !== fkName);
      });
  });
}

function removeColumnsInRelation(entities: Entity[]) {
  entities.forEach(entity => {
    entity.columns = entity.columns.filter(
      column =>
        !column.isUsedInRelationAsOwner ||
        column.isUsedInRelationAsReferenced ||
        entity.indices.some(idx => idx.columns.some(v => v === column.tscName)) ||
        column.primary,
    );
  });
}

function removeColumnDefaultProperties(entities: Entity[], defaultValues: DataTypeDefaults) {
  if (!defaultValues) {
    return;
  }

  entities.forEach(entity => {
    entity.columns.forEach(column => {
      const defVal = defaultValues[column.tscType];
      if (defVal) {
        if (column.options.length && defVal.length && column.options.length === defVal.length) {
          column.options.length = undefined;
        }
        if (
          column.options.precision &&
          defVal.precision &&
          column.options.precision === defVal.precision &&
          column.options.scale &&
          defVal.scale &&
          column.options.scale === defVal.scale
        ) {
          column.options.precision = undefined;
          column.options.scale = undefined;
        }
        if (column.options.width && defVal.width && column.options.width === defVal.width) {
          column.options.width = undefined;
        }
      }
    });
  });
}

function removeIndices(entities: Entity[]) {
  entities.forEach(entity => {
    entity.indices = [];
  });
}

function removeRelations(entities: Entity[]) {
  entities.forEach(entity => {
    entity.relations = [];
  });
}

function changeRelationNames(entities: Entity[], pluralizeNames: boolean) {
  entities.forEach(entity => {
    entity.relations.forEach(relation => {
      const oldName = relation.fieldName;
      let newName = namingStrategy.getRelationName(relation, pluralizeNames);
      newName = findNameForNewField(newName, entity, oldName);

      const relatedEntity = entities.find(v => v.tscName === relation.relatedTable)!;
      const relation2 = relatedEntity.relations.find(v => v.fieldName === relation.relatedField)!;

      entity.relationIds
        .filter(v => v.relationField === oldName)
        .forEach(v => {
          v.relationField = newName;
        });

      relation.fieldName = newName;
      relation2.relatedField = newName;

      if (relation.relationOptions) {
        entity.indices.forEach(ind => {
          ind.columns.map(column2 => (column2 === oldName ? newName : column2));
        });
      }
    });
  });
}

function changeRelationIdNames(entities: Entity[], pluralizeNames: boolean) {
  entities.forEach(entity => {
    entity.relationIds.forEach(relationId => {
      const oldName = relationId.fieldName;
      const relation = entity.relations.find(v => v.fieldName === relationId.relationField)!;
      let newName = namingStrategy.getRelationIdName(relationId, relation, pluralizeNames);
      newName = findNameForNewField(newName, entity, oldName);
      entity.indices.forEach(index => {
        index.columns = index.columns.map(column2 => (column2 === oldName ? newName : column2));
      });

      relationId.fieldName = newName;
    });
  });
}

function changeColumnNames(entities: Entity[]) {
  entities.forEach(entity => {
    entity.columns.forEach(column => {
      const oldName = column.tscName;
      let newName = namingStrategy.getColumnName(column.tscName);
      newName = findNameForNewField(newName, entity, oldName);
      entity.indices.forEach(index => {
        index.columns = index.columns.map(column2 => (column2 === oldName ? newName : column2));
      });

      column.tscName = newName;
    });
  });
}

function changeEntityNames(entities: Entity[]) {
  entities.forEach(entity => {
    const newName = namingStrategy.getEntityName(entity.tscName);
    entities.forEach(entity2 => {
      entity2.relations.forEach(relation => {
        if (relation.relatedTable === entity.tscName) {
          relation.relatedTable = newName;
        }
      });
    });
    entity.tscName = newName;
    entity.fileName = newName;
  });
}

function changeFileNames(entities: Entity[]) {
  entities.forEach(entity => {
    entity.fileName = namingStrategy.getFileName(entity.fileName);
  });
}

function addImportsAndGenerationOptions(entities: Entity[], generationOptions: GenerationOptions) {
  entities.forEach(entity => {
    entity.relations.forEach(relation => {
      if (
        relation.relatedTable !== entity.tscName &&
        !entity.fileImports.some(v => v.entityName === relation.relatedTable)
      ) {
        const relatedTable = entities.find(related => related.tscName == relation.relatedTable)!;
        entity.fileImports.push({
          entityName: relatedTable.tscName,
          fileName: relatedTable.fileName,
        });
      }

      if (generationOptions.lazy) {
        if (!relation.relationOptions) {
          relation.relationOptions = {};
        }
        relation.relationOptions.lazy = true;
      }
    });
    if (generationOptions.skipSchema) {
      entity.schema = undefined;
      entity.database = undefined;
    }
    if (generationOptions.activeRecord) {
      entity.activeRecord = true;
    }
    if (generationOptions.generateConstructor) {
      entity.generateConstructor = true;
    }
  });
}
