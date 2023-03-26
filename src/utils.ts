/* eslint-disable no-console */
import { camelCase } from 'change-case';
import { resolve } from 'path';

import { Entity } from './models/entity';

export function logInfo(message: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

export function logWarn(message: string) {
  console.warn(`\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: ${message}\x1b[0m`);
}

export function logError(errText: string, sourceError?: Error): void {
  console.error(`\x1b[31m[${new Date().toLocaleTimeString()}] ${errText}\x1b[0m`);
  if (sourceError) {
    console.error(sourceError);
  }
}

export function resolvePath(...paths: string[]) {
  return resolve(__dirname, '..', ...paths);
}

export function findNameForNewField(fieldName: string, entity: Entity, columnOldName = ''): string {
  let newFieldName = fieldName;

  const validNameCondition = () =>
    (entity.columns.every(v => camelCase(v.tscName) !== camelCase(newFieldName)) &&
      entity.relations.every(v => camelCase(v.fieldName) !== camelCase(newFieldName)) &&
      entity.relationIds.every(v => camelCase(v.fieldName) !== camelCase(newFieldName))) ||
    (columnOldName && camelCase(columnOldName) === camelCase(newFieldName));

  if (!validNameCondition()) {
    newFieldName += '_';
    for (let i = 2; i <= entity.columns.length + entity.relations.length; i++) {
      newFieldName = newFieldName.substring(0, newFieldName.length - i.toString().length) + i.toString();
      if (validNameCondition()) {
        break;
      }
    }
  }

  return newFieldName;
}

export function filterGeneratedEntities(skipTables: string[], onlyTables: string[], entities: Entity[]) {
  const selectedEntities = entities
    .filter(entity => !skipTables.includes(entity.sqlName))
    .filter(entity => onlyTables.length === 0 || onlyTables.includes(entity.sqlName));

  const selectedEntitiesWithRels = selectedEntities.map(entity => {
    const relatedTables = entity.relations.map(rel => rel.relatedTable);
    const relatedEntities = entities.filter(entity2 => relatedTables.includes(entity2.sqlName));
    return [entity, ...relatedEntities];
  });

  return [...new Set(selectedEntitiesWithRels.flat())];
}
