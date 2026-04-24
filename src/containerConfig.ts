import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { jsLogger } from '@map-colonies/js-logger';
import { type InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { SERVICES, SERVICE_NAME } from '@common/constants';
import { getTracing } from '@common/tracing';
import { getConfig } from './common/config';
import { SyncManager } from './scheduler/syncManager';
import { initializeDb, closeDb } from './dal/connection';
import { ConnectionManager, type HealthCheck } from './dal/connectionManager';
import { getSyncConfig } from './common/syncConfig';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const configInstance = getConfig();

  const loggerConfig = configInstance.get('telemetry.logger');

  const logger = await jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  const tracer = trace.getTracer(SERVICE_NAME);
  const metricsRegistry = new Registry();
  configInstance.initializeMetrics(metricsRegistry);

  const syncConfig = getSyncConfig();
  const dataSource = await initializeDb(syncConfig.layers);
  const { host, port, database } = dataSource.options as { host: string; port: number; database: string };
  logger.info(`Database connected to ${host}:${port}/${database} (layer partitions: ${syncConfig.layers.join(', ')})`);

  const syncManager = new SyncManager(logger);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
    { token: SERVICES.SYNC_MANAGER, provider: { useValue: syncManager } },
    { token: ConnectionManager, provider: { useClass: ConnectionManager } },
    {
      token: SERVICES.HEALTH_CHECK,
      provider: {
        useFactory: (dependencyContainer: DependencyContainer): HealthCheck => {
          const connectionManager = dependencyContainer.resolve(ConnectionManager);
          return async () => {
            await Promise.resolve(connectionManager.healthCheck());
          };
        },
      },
    },
    {
      token: 'onSignal',
      provider: {
        useValue: async (): Promise<void> => {
          await syncManager.stop();
          await Promise.all([closeDb(), getTracing().stop()]);
        },
      },
    },
  ];

  return Promise.resolve(registerDependencies(dependencies, options?.override, options?.useChild));
};
