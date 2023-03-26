import { camelCase, paramCase, pascalCase, snakeCase } from 'change-case';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as Handlebars from 'handlebars';
import { resolve } from 'path';

import { Entity } from '../models/entity';
import { Relation } from '../models/relation';
import { ConnectionOptions } from '../options/connection-options';
import { GenerationOptions } from '../options/generation-options';
import { filterGeneratedEntities } from '../utils';

export async function generateModules(
  connectionOptions: ConnectionOptions,
  generationOptions: GenerationOptions,
  entities: Entity[],
) {
  createHandlebarsHelpers(generationOptions);

  const outputPath = resolve(process.cwd(), generationOptions.outputPath);
  await rm(outputPath, { force: true, recursive: true });
  await mkdir(outputPath, { recursive: true });

  entities = filterGeneratedEntities(connectionOptions.skipTables, connectionOptions.onlyTables, entities);
  if (generationOptions.indexFile) {
    await createIndexFile(generationOptions, outputPath, entities);
  }
  await generateEntities(generationOptions, outputPath, entities);
}

async function createIndexFile(generationOptions: GenerationOptions, outputPath: string, entities: Entity[]) {
  const templatePath = resolve(__dirname, '..', 'templates', 'index.mst');
  const template = await readFile(templatePath, 'utf-8');
  const compliedTemplate = Handlebars.compile(template, {
    noEscape: true,
  });
  const rendered = compliedTemplate({ entities: entities });

  let fileName = 'index';
  switch (generationOptions.convertCaseFile) {
    case 'camel':
      fileName = camelCase(fileName);
      break;
    case 'param':
      fileName = paramCase(fileName);
      break;
    case 'pascal':
      fileName = pascalCase(fileName);
      break;
  }

  const resultFilePath = resolve(outputPath, `${fileName}.ts`);
  await writeFile(resultFilePath, rendered, {
    encoding: 'utf-8',
    flag: 'w',
  });
}

async function generateEntities(generationOptions: GenerationOptions, outputPath: string, entities: Entity[]) {
  const entityTemplatePath = resolve(__dirname, '..', 'templates', 'entity.mst');
  const entityTemplate = await readFile(entityTemplatePath, 'utf-8');
  const compliedTemplate = Handlebars.compile(entityTemplate, {
    noEscape: true,
  });

  await entities.map(entity => {
    let casedFileName = '';
    switch (generationOptions.convertCaseFile) {
      case 'camel':
        casedFileName = camelCase(entity.fileName);
        break;
      case 'param':
        casedFileName = paramCase(entity.fileName);
        break;
      case 'pascal':
        casedFileName = pascalCase(entity.fileName);
        break;
      case 'none':
        casedFileName = entity.fileName;
        break;
      default:
        throw new Error('Unknown case style');
    }

    const resultFilePath = resolve(outputPath, `${casedFileName}.ts`);
    const rendered = compliedTemplate(entity);
    const withImportStatements = removeUnusedImports(rendered);

    return writeFile(resultFilePath, withImportStatements, {
      encoding: 'utf-8',
      flag: 'w',
    });
  });
}

function removeUnusedImports(rendered: string) {
  const openBracketIndex = rendered.indexOf('{') + 1;
  const closeBracketIndex = rendered.indexOf('}');
  const imports = rendered.substring(openBracketIndex, closeBracketIndex).split(',');

  const restOfEntityDefinition = rendered.substring(closeBracketIndex);
  const distinctImports = imports.filter(
    v =>
      restOfEntityDefinition.indexOf(`@${v}(`) !== -1 ||
      (v === 'BaseEntity' && restOfEntityDefinition.indexOf(v) !== -1),
  );

  return `${rendered.substring(0, openBracketIndex)}${distinctImports.join(',')}${restOfEntityDefinition}`;
}

function createHandlebarsHelpers(generationOptions: GenerationOptions) {
  Handlebars.registerHelper('json', context => {
    const json = JSON.stringify(context);
    const withoutQuotes = json.replace(/"([^(")"]+)":/g, '$1:');
    return withoutQuotes.slice(1, withoutQuotes.length - 1);
  });

  Handlebars.registerHelper('getEntityName', (str: string) => {
    switch (generationOptions.convertCaseEntity) {
      case 'camel':
        return camelCase(str);
      case 'pascal':
        return pascalCase(str);
      case 'none':
        return str;
      default:
        throw new Error('Unknown case style');
    }
  });

  Handlebars.registerHelper('getFileName', (str: string) => {
    switch (generationOptions.convertCaseFile) {
      case 'camel':
        return camelCase(str);
      case 'param':
        return paramCase(str);
      case 'pascal':
        return pascalCase(str);
      case 'none':
        return str;
      default:
        throw new Error('Unknown case style');
    }
  });

  Handlebars.registerHelper('getPropertyName', (str: string) => {
    switch (generationOptions.convertCaseProperty) {
      case 'camel':
        return camelCase(str);
      case 'pascal':
        return pascalCase(str);
      case 'snake':
        return snakeCase(str);
      case 'none':
        return str;
      default:
        throw new Error('Unknown case style');
    }
  });

  Handlebars.registerHelper('getRelation', (entityType: string, relationType: Relation['relationType']) => {
    let result = entityType;
    if (relationType === 'ManyToMany' || relationType === 'OneToMany') {
      result = `${result}[]`;
    }
    if (generationOptions.lazy) {
      result = `Promise<${result}>`;
    }
    return result;
  });

  Handlebars.registerHelper('propertyVisibility', () =>
    generationOptions.propertyVisibility !== 'none' ? `${generationOptions.propertyVisibility} ` : '',
  );

  Handlebars.registerHelper('defaultExport', () => (generationOptions.exportType === 'default' ? 'default' : ''));

  Handlebars.registerHelper('localImport', (entityName: string) =>
    generationOptions.exportType === 'default' ? entityName : `{${entityName}}`,
  );

  Handlebars.registerHelper('strictMode', () =>
    generationOptions.strictMode !== 'none' ? generationOptions.strictMode : '',
  );
}
