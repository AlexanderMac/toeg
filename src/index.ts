import { readFile } from 'fs/promises';

import { AbstractDriver } from './drivers/abstract-driver';
import { PostgresDriver } from './drivers/postgres-driver';
import { ConnectionOptions, getDefaultConnectionOptions } from './options/connection-options';
import { GenerationOptions, getDefaultGenerationOptions } from './options/generation-options';
import { customizeEntities } from './processing/customization';
import { generateModules } from './processing/generation';
import { logError, logInfo, resolvePath } from './utils';

(async function main() {
  logInfo('Reading the config');
  const connectionOptions = getDefaultConnectionOptions();
  const generationOptions = getDefaultGenerationOptions();
  await readConfig(connectionOptions, generationOptions);
  validateConfig(connectionOptions, generationOptions);

  logInfo(`Creating the ${connectionOptions.databaseType} database driver`);
  const driver = createDriver(connectionOptions.databaseType);

  logInfo('Creating entities');
  await createModelFromDatabase(driver, connectionOptions, generationOptions);

  logInfo('Done');
})();

async function readConfig(connectionOptions: ConnectionOptions, generationOptions: GenerationOptions) {
  const toegConfigStr = await (await readFile(resolvePath('toeg.json'))).toString();
  const toegConfig = JSON.parse(toegConfigStr);
  const { connection: loadedConnectionOptions, generation: loadedGenerationOptions } = toegConfig as any;

  if (loadedConnectionOptions) {
    Object.keys(loadedConnectionOptions).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(connectionOptions, key)) {
        (connectionOptions as any)[key] = loadedConnectionOptions[key];
      } else {
        logError(`Unknown connection option ${key}`);
      }
    });
  }

  if (loadedGenerationOptions) {
    Object.keys(loadedGenerationOptions).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(generationOptions, key)) {
        (generationOptions as any)[key] = loadedGenerationOptions[key];
      } else {
        logError(`Unknown generation option ${key}`);
      }
    });
  }
}

// TODO: validate only required props
function validateConfig(connectionOptions: ConnectionOptions, generationOptions: GenerationOptions) {
  if (generationOptions.lazy && generationOptions.relationIds) {
    logError("Typeorm doesn't support RelationId fields for lazy relations");
    generationOptions.relationIds = false;
  }
}

function createDriver(driverName: string): AbstractDriver {
  switch (driverName) {
    case 'postgres':
      return new PostgresDriver();
    default:
      throw new Error('Database engine not recognized');
  }
}

async function createModelFromDatabase(
  driver: AbstractDriver,
  connectionOptions: ConnectionOptions,
  generationOptions: GenerationOptions,
) {
  const entities = await driver.getDataFromServer(connectionOptions, generationOptions);
  if (entities.length === 0) {
    logError('Tables not found in selected database');
    return;
  }

  customizeEntities(generationOptions, driver.defaultValues, entities);
  await generateModules(connectionOptions, generationOptions, entities);
}
