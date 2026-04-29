import { DataSource } from 'typeorm';
import { getDbConfig } from '../common/dbConfig';
import { createConnectionOptions } from './connectionOptions';
import { getLayerPartitionName } from './entities/layerObject';

let dataSource: DataSource | undefined;

export function createDataSource(): DataSource {
  const dbConfig = getDbConfig();
  return new DataSource(createConnectionOptions(dbConfig));
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
    await ds.query(`CREATE TABLE IF NOT EXISTS "${partitionName}" PARTITION OF layer_objects FOR VALUES IN ('${layerName}')`);
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
