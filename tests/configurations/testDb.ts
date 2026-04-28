import path from 'path';
import { DataSource } from 'typeorm';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { SyncStateEntry } from '@src/dal/entities/syncState';

export const TEST_DB_HOST = '127.0.0.1';
export const TEST_DB_PORT = 55432;
export const TEST_DB_USER = 'postgres';
export const TEST_DB_PASSWORD = 'postgres';
export const TEST_DB_NAME = 'sync_layer_test';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const MIGRATION_FILE = path.join(REPO_ROOT, 'migrations', '001_create_tables.sql');

export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    username: TEST_DB_USER,
    password: TEST_DB_PASSWORD,
    database: TEST_DB_NAME,
    entities: [SyncStateEntry, LayerObjectEntity],
    synchronize: false,
    logging: false,
  });
}
