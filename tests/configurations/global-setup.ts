import { readFileSync } from 'fs';
import path from 'path';
import dockerCompose from 'docker-compose';
import { DataSource } from 'typeorm';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { SyncStateEntry } from '@src/dal/entities/syncState';
import globalTeardown from './global-teardown';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_FILE = path.join(REPO_ROOT, 'migrations', '001_create_tables.sql');

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('🟢 Starting Docker containers...');
  await dockerCompose.upAll({
    cwd: REPO_ROOT,
    config: 'docker-compose.test.yml',
    commandOptions: ['--remove-orphans'],
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('⏳ Initializing database schema...');

  // Create a temporary DataSource just to run the migration SQL
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 55432,
    username: 'postgres',
    password: 'postgres',
    database: 'sync_layer_test',
    entities: [SyncStateEntry, LayerObjectEntity],
    synchronize: false,
    logging: false,
    ssl: false,
  });

  try {
    await AppDataSource.initialize();
    await AppDataSource.query(readFileSync(MIGRATION_FILE, 'utf8'));
    console.log('✅ Migrations completed');
  } catch (err) {
    console.warn('⚠️  Migration initialization warning:', err instanceof Error ? err.message : String(err));
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
  console.log('🚀 Environment ready for tests');

  return globalTeardown;
}
