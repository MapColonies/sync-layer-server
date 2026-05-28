import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { Logger } from '@map-colonies/js-logger';
import { SyncStatus, type ScheduleEntry } from '../types';
import { getSyncConfig } from '../common/syncConfig';
import * as syncStateRepository from '../dal/repositories/syncStateRepository';
import * as layerClient from '../externalClients/layersClient/layersClient';
import * as layerDataRepository from '../dal/repositories/layerDataRepository';
import { SERVICE_NAME } from '../common/constants';

const tracer = trace.getTracer(SERVICE_NAME);

export async function fetchAndSyncLayerPage(logger: Logger, entry: ScheduleEntry): Promise<void> {
  const config = getSyncConfig();
  const state = await syncStateRepository.getSyncState(entry.layerName);

  await asyncCallWithSpan(
    async () => {
      try {
        logger.info(`Fetching page for layer "${entry.layerName}" - status: ${state.status}, lastSequence: ${state.lastSequence}`);

        const response = await layerClient.fetchPage(logger, entry.layerName, state.lastSequence);

        logger.info(`Received ${response.fetchedCount} objects, ${response.deletedCount} deleted for layer "${entry.layerName}"`);

        if (response.objects.length > 0) {
          logger.info(`Inserting ${response.objects.length} new objects into layer "${entry.layerName}"`);
          await layerDataRepository.insertObjects(logger, entry.layerName, response.objects);
        }

        if (response.deletedIds.length > 0) {
          logger.info(`Deleting ${response.deletedIds.length} deprecated objects from layer "${entry.layerName}"`);
          await layerDataRepository.deleteDeprecatedObjects(entry.layerName, response.deletedIds);
        }

        await syncStateRepository.updateSequence(entry.layerName, response.nextSequence);

        if (state.status === SyncStatus.SYNCING && response.fetchedCount === 0) {
          await syncStateRepository.setStatus(entry.layerName, SyncStatus.READY);
          logger.info(`Layer "${entry.layerName}" initial sync complete - status set to READY`);
        }
      } catch (error) {
        logger.error(`Error processing layer "${entry.layerName}": ${(error as Error).message}`);
      }
    },
    tracer,
    'sync.fetchAndSyncLayerPage'
  );

  const updatedState = await syncStateRepository.getSyncState(entry.layerName);
  const interval = updatedState.status === SyncStatus.SYNCING ? config.syncIntervalMs : config.pollIntervalMs;

  entry.nextRunAt = Date.now() + interval;
}
