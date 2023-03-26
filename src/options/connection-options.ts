export interface ConnectionOptions {
  host: string;
  port: number;
  databaseNames: string[];
  user: string;
  password: string;
  databaseType: 'postgres';
  schemaNames: string[];
  instanceName?: string;
  ssl: boolean;
  skipTables: string[];
  onlyTables: string[];
}

export function getDefaultConnectionOptions(): ConnectionOptions {
  const connectionOptions: ConnectionOptions = {
    host: '127.0.0.1',
    port: 0,
    databaseNames: [''],
    user: '',
    password: '',
    databaseType: 'postgres',
    schemaNames: [''],
    instanceName: undefined,
    ssl: false,
    skipTables: [],
    onlyTables: [],
  };

  return connectionOptions;
}
