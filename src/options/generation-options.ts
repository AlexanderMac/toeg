import * as path from 'path';

export interface GenerationOptions {
  outputPath: string;
  pluralizeNames: boolean;
  convertCaseFile: 'pascal' | 'param' | 'camel' | 'none';
  convertCaseEntity: 'pascal' | 'camel' | 'none';
  convertCaseProperty: 'pascal' | 'camel' | 'snake' | 'none';
  propertyVisibility: 'public' | 'protected' | 'private' | 'none';
  lazy: boolean;
  activeRecord: boolean;
  generateConstructor: boolean;
  relationIds: boolean;
  strictMode: 'none' | '?' | '!';
  skipSchema: boolean;
  indexFile: boolean;
  exportType: 'named' | 'default';
}

export function getDefaultGenerationOptions(): GenerationOptions {
  const generationOptions: GenerationOptions = {
    outputPath: path.resolve(process.cwd(), 'output'),
    pluralizeNames: true,
    convertCaseFile: 'pascal',
    convertCaseEntity: 'pascal',
    convertCaseProperty: 'camel',
    propertyVisibility: 'none',
    lazy: false,
    activeRecord: false,
    generateConstructor: false,
    relationIds: false,
    strictMode: 'none',
    skipSchema: false,
    indexFile: false,
    exportType: 'named',
  };

  return generationOptions;
}
