import { Column } from './column';
import { Index } from './index';
import { Relation } from './relation';
import { RelationId } from './relation-id';

export type Entity = {
  database?: string;
  schema?: string;
  sqlName: string;
  tscName: string;
  columns: Column[];
  relationIds: RelationId[];
  relations: Relation[];
  indices: Index[];
  fileName: string;
  fileImports: {
    entityName: string;
    fileName: string;
  }[];
  activeRecord?: true;
  generateConstructor?: true;
};
