import pluralize from 'pluralize';

import { Relation } from '../models/relation';
import { RelationId } from '../models/relation-id';

export function getRelationName(relation: Relation, pluralizeNames: boolean): string {
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
  if (isRelationToMany && pluralizeNames) {
    newColumnName = pluralize(newColumnName);
  }
  return newColumnName;
}

export function getRelationIdName(relationId: RelationId, relation: Relation, pluralizeNames: boolean): string {
  const columnOldName = relationId.fieldName;

  const isRelationToMany = relation.relationType === 'OneToMany' || relation.relationType === 'ManyToMany';
  let newColumnName = columnOldName.replace(/[0-9]$/, '');

  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (!Number.isNaN(parseInt(newColumnName[newColumnName.length - 1], 10))) {
    newColumnName = newColumnName.substring(0, newColumnName.length - 1);
  }
  if (isRelationToMany && pluralizeNames) {
    newColumnName = pluralize(newColumnName);
  }

  return newColumnName;
}

export function getEntityName(oldEntityName: string): string {
  return oldEntityName;
}

export function getColumnName(oldColumnName: string): string {
  return oldColumnName;
}

export function getFileName(oldFileName: string): string {
  return oldFileName;
}
