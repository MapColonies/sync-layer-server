/* istanbul ignore file */
import { readFileSync } from 'node:fs';
import type { DataSourceOptions } from 'typeorm';
import type { DbConfig } from '../types';
import { LayerObjectEntity } from './entities/layerObject';
import { SyncStateEntry } from './entities/syncState';

export const createConnectionOptions = (dbConfig: DbConfig): DataSourceOptions => {
  const ENTITIES = [SyncStateEntry, LayerObjectEntity];
  const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;

  const baseOptions: DataSourceOptions = {
    ...connectionOptions,
    entities: ENTITIES,
    ssl: false,
    synchronize: false,
  };

  if (enableSslAuth === true && sslPaths) {
    const rejectUnauthorized = process.env.NODE_ENV === 'production';
    return {
      ...baseOptions,
      ssl: {
        key: readFileSync(sslPaths.key),
        cert: readFileSync(sslPaths.cert),
        ca: readFileSync(sslPaths.ca),
        rejectUnauthorized,
      },
    };
  }

  return baseOptions;
};
