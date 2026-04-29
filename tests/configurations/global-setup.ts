import path from 'path';
import dockerCompose from 'docker-compose';
import { DataSource } from 'typeorm';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { SyncStateEntry } from '@src/dal/entities/syncState';
import { InitialSchema1777420800000 } from '@src/dal/migrations/1777420800000-InitialSchema';
import globalTeardown from './global-teardown';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('🟢 Starting Docker containers...');
  await dockerCompose.upAll({
    cwd: REPO_ROOT,
    config: 'docker-compose.test.yml',
    commandOptions: ['--remove-orphans', '--wait'],
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
    migrations: [InitialSchema1777420800000],
    synchronize: false,
    logging: false,
    ssl: false,
  });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await AppDataSource.initialize();
      await AppDataSource.runMigrations();
      console.log('✅ Migrations completed');
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (AppDataSource.isInitialized) await AppDataSource.destroy();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  if (lastErr !== undefined) {
    console.warn('⚠️  Migration initialization warning:', lastErr instanceof Error ? lastErr.message : String(lastErr));
  }
  console.log('🚀 Environment ready for tests');

  return globalTeardown;
}
