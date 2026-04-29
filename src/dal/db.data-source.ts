/* istanbul ignore file */
import path from 'path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { DbConfig } from '../types';
import { createConnectionOptions } from './connectionOptions';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const dbConfig: DbConfig = {
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

const buildConnectionOptions = (): DataSourceOptions => {
  const options = createConnectionOptions(dbConfig);
  return {
    ...options,
    migrations: [path.join(__dirname, 'migrations', '*.ts')],
  };
};

/* eslint-disable @typescript-eslint/naming-convention */
export default new DataSource(buildConnectionOptions());
