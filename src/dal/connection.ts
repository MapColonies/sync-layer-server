import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { getDbConfig } from '../common/dbConfig';
import { SyncStateEntry } from './entities/syncState';
import { LayerObjectEntity, getLayerPartitionName } from './entities/layerObject';

let dataSource: DataSource | undefined;

function buildSslOptions(dbConfig: ReturnType<typeof getDbConfig>): PostgresConnectionOptions['ssl'] {
  if (dbConfig.enableSslAuth !== true) return false;
  const { sslPaths } = dbConfig;
  if (sslPaths === undefined || sslPaths.ca === '' || sslPaths.cert === '' || sslPaths.key === '') {
    return { rejectUnauthorized: false };
  }
  return {
    ca: readFileSync(sslPaths.ca, 'utf8'),
    cert: readFileSync(sslPaths.cert, 'utf8'),
    key: readFileSync(sslPaths.key, 'utf8'),
    rejectUnauthorized: true,
  };
}

export function createDataSource(): DataSource {
  const dbConfig = getDbConfig();

  return new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    username: dbConfig.username,
    password: dbConfig.password,
    ssl: buildSslOptions(dbConfig),
    entities: [SyncStateEntry, LayerObjectEntity],
    synchronize: false,
  });
}

export async function initializeDb(layers: string[]): Promise<DataSource> {
  if (dataSource?.isInitialized === true) {
    return dataSource;
  }

  dataSource = createDataSource();
  await dataSource.initialize();
  await ensureLayerPartitions(dataSource, layers);
  return dataSource;
}

async function ensureLayerPartitions(ds: DataSource, layers: string[]): Promise<void> {
  for (const layerName of layers) {
    const partitionName = getLayerPartitionName(layerName);
    await ds.query(
      `CREATE TABLE IF NOT EXISTS "${partitionName}" PARTITION OF layer_objects FOR VALUES IN ('${layerName}')`
    );
  }
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
