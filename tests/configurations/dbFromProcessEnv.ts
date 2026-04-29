import { DataSource, type DataSourceOptions } from 'typeorm';
import type { DbConfig } from '@src/types/dbConfig';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing ${name}: integration tests require env from vitest globalSetup / test env`);
  }
  return value;
}

/** TypeORM DataSource using DB_* env (set in vitest integration project `env` after docker globalSetup). */
export function createDataSourceFromTestEnv(entities: DataSourceOptions['entities'], overrides?: Partial<DataSourceOptions>): DataSource {
  return new DataSource({
    type: 'postgres',
    host: requireEnv('DB_HOST'),
    port: parseInt(requireEnv('DB_PORT'), 10),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    entities,
    synchronize: false,
    logging: false,
    ...overrides,
  });
}

export function getTestDbConfigFromEnv(): DbConfig {
  return {
    type: 'postgres',
    host: requireEnv('DB_HOST'),
    port: parseInt(requireEnv('DB_PORT'), 10),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    enableSslAuth: process.env.DB_ENABLE_SSL?.toLowerCase() === 'true',
    sslPaths: {
      key: process.env.DB_SSL_KEY_PATH ?? '',
      cert: process.env.DB_SSL_CERT_PATH ?? '',
      ca: process.env.DB_SSL_CA_PATH ?? '',
    },
  };
}
