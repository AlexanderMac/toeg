import { ColumnType } from 'typeorm';

export type Column = {
  tscType: string;
  tscName: string;
  type: ColumnType | string;
  isUsedInRelationAsOwner?: true; // TODO: move to separate object/calculate when us
  isUsedInRelationAsReferenced?: true; // TODO: move to separate object/calculate when us

  primary?: boolean;
  generated?: true | 'increment' | 'uuid';
  default?: string;
  options: {
    name: string;
    length?: number;
    width?: number;
    nullable?: boolean;
    unique?: boolean;
    precision?: number;
    scale?: number;
    unsigned?: boolean;
    enum?: string[];
    array?: boolean;
    comment?: string;
  };
};
