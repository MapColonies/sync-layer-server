import { DataSource } from 'typeorm';
import { getDbConfig } from '../common/dbConfig';
import { SyncStateEntry } from './entities/syncState';
import { LayerObjectEntity } from './entities/layerObject';

let dataSource: DataSource | undefined;

export function createDataSource(): DataSource {
  const dbConfig = getDbConfig();

  return new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    username: dbConfig.username,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    entities: [SyncStateEntry, LayerObjectEntity],
    synchronize: false,
    poolSize: dbConfig.poolSize,
  });
}

export async function initializeDb(): Promise<DataSource> {
  if (dataSource?.isInitialized === true) {
    return dataSource;
  }

  dataSource = createDataSource();
  await dataSource.initialize();
  return dataSource;
}

export function getDataSource(): DataSource {
  if (dataSource?.isInitialized !== true) {
    throw new Error('DataSource not initialized. Call initializeDb() first.');
  }
  return dataSource;
}

export async function closeDb(): Promise<void> {
  if (dataSource?.isInitialized === true) {
    await dataSource.destroy();
    dataSource = undefined;
  }
}
