import * as path from 'path';

export interface GenerationOptions {
  outputPath: string;
  pluralizeNames: boolean;
  fileCase: 'pascal' | 'param' | 'camel' | 'none';
  entityCase: 'pascal' | 'camel' | 'none';
  propertyCase: 'pascal' | 'camel' | 'snake' | 'none';
  entityPostfix: string;
  propertyVisibility: 'public' | 'protected' | 'private' | 'none';
  lazy: boolean;
  activeRecord: boolean;
  generateConstructor: boolean;
  relationIds: boolean;
  strictMode: 'none' | '?' | '!';
  skipIndices: boolean;
  skipSchema: boolean;
  skipRelations: boolean;
  indexFile: boolean;
  exportType: 'named' | 'default';
  silent: boolean;
}

export function getDefaultGenerationOptions(): GenerationOptions {
  const generationOptions: GenerationOptions = {
    outputPath: path.resolve(process.cwd(), 'output'),
    pluralizeNames: true,
    fileCase: 'pascal',
    entityCase: 'pascal',
    propertyCase: 'camel',
    entityPostfix: '',
    propertyVisibility: 'none',
    lazy: false,
    activeRecord: false,
    generateConstructor: false,
    relationIds: false,
    strictMode: 'none',
    skipSchema: false,
    skipIndices: false,
    skipRelations: false,
    indexFile: false,
    exportType: 'named',
    silent: false,
  };

  return generationOptions;
}
