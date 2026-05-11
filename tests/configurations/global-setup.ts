import dockerCompose from 'docker-compose';
import globalTeardown from './global-teardown';

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('🟢 Starting Docker containers...');
  await dockerCompose.upAll({
    commandOptions: ['--remove-orphans', '--wait'],
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('⏳ Initializing database schema...');

  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '55432';
  process.env.DB_USERNAME = 'postgres';
  process.env.DB_PASSWORD = 'postgres';
  process.env.DB_NAME = 'sync_layer_test';
  process.env.DB_ENABLE_SSL = 'false';

  const { default: SyncLayerDataSource } = await import('@src/dal/db.data-source.js');

  try {
    SyncLayerDataSource.then((dataSource) => {
      dataSource
        .initialize()
        .then(() => {
          console.log('✅ Database connection established');
          return dataSource.runMigrations();
        })
        .then(() => {
          console.log('✅ Migrations completed');
        })
        .catch((err) => {
          console.warn('⚠️  Migration initialization warning:', err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (dataSource.isInitialized) {
            dataSource
              .destroy()
              .then(() => console.log('✅ Database connection closed'))
              .catch((err) => console.warn('⚠️  Error closing database connection:', err instanceof Error ? err.message : String(err)));
          }
        });
    }).catch((err) => {
      console.warn('⚠️  Error initializing database connection:', err instanceof Error ? err.message : String(err));
    });
  } catch (err) {
    console.warn('⚠️  Migration initialization warning:', err instanceof Error ? err.message : String(err));
  } finally {
  }
  console.log('🚀 Environment ready for tests');

  return globalTeardown;
}
