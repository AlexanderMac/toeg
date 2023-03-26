import pluralize from 'pluralize';

import { Relation } from '../models/relation';
import { RelationId } from '../models/relation-id';

let isPluralize: boolean;

export function enablePluralization() {
  isPluralize = true;
}

export function relationIdName(relationId: RelationId, relation: Relation): string {
  const columnOldName = relationId.fieldName;

  const isRelationToMany = relation.relationType === 'OneToMany' || relation.relationType === 'ManyToMany';
  let newColumnName = columnOldName.replace(/[0-9]$/, '');

  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (isRelationToMany && isPluralize) {
    newColumnName = pluralize(newColumnName);
  }

  return newColumnName;
}

export function relationName(relation: Relation): string {
  const columnOldName = relation.fieldName;

  const isRelationToMany = relation.relationType === 'OneToMany' || relation.relationType === 'ManyToMany';
  let newColumnName = columnOldName.replace(/[0-9]$/, '');

  if (newColumnName.toLowerCase().endsWith('id') && !newColumnName.toLowerCase().endsWith('guid')) {
    newColumnName = newColumnName.substring(0, newColumnName.toLowerCase().lastIndexOf('id'));
  }
  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (isRelationToMany && isPluralize) {
    newColumnName = pluralize(newColumnName);
  }
  return newColumnName;
}

export function entityName(oldEntityName: string): string {
  return oldEntityName;
}

export function columnName(oldColumnName: string): string {
  return oldColumnName;
}

export function fileName(oldFileName: string): string {
  return oldFileName;
}
