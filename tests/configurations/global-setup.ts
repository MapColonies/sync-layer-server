import path from 'path';
import dockerCompose from 'docker-compose';
import { DataSource } from 'typeorm';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { SyncStateEntry } from '@src/dal/entities/syncState';
import { CreateTables1713196800000 } from '@src/dal/migrations/1713196800000-CreateTables';
import globalTeardown from './global-teardown';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('🟢 Starting Docker containers...');
  await dockerCompose.upAll({
    cwd: REPO_ROOT,
    config: 'docker-compose.test.yml',
    commandOptions: ['--remove-orphans'],
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('⏳ Initializing database schema...');

  const AppDataSource = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 55432,
    username: 'postgres',
    password: 'postgres',
    database: 'sync_layer_test',
    entities: [SyncStateEntry, LayerObjectEntity],
    migrations: [CreateTables1713196800000],
    synchronize: false,
    logging: false,
    ssl: false,
  });

  try {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
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
