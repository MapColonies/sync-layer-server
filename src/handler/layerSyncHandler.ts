import type { Logger } from '@map-colonies/js-logger';
import { SyncStatus, type ScheduleEntry } from '../types';
import { getSyncConfig } from '../common/syncConfig';
import * as syncStateRepository from '../dal/repositories/syncStateRepository';
import * as layerClient from '../externalClients/layersClient/layersClient';
import * as layerDataRepository from '../dal/repositories/layerDataRepository';

export async function fetchAndSyncLayerPage(logger: Logger, entry: ScheduleEntry): Promise<void> {
  const config = getSyncConfig();
  const state = await syncStateRepository.getSyncState(entry.layerName);

  try {
    logger.info(
      `Fetching page for layer "${entry.layerName}" - status: ${state.status}, offset: ${state.lastOffset}`
    );

    const response = await layerClient.fetchPage(entry.layerName, state.lastOffset);

    logger.info(
      `Received ${response.returnedCount} objects, ${response.deprecated.length} deprecated for layer "${entry.layerName}"`
    );

    if (response.objects.length > 0) {
      logger.info(`Inserting ${response.objects.length} new objects into layer "${entry.layerName}"`);
      await layerDataRepository.insertObjects(entry.layerName, response.objects);
    }

    if (response.deprecated.length > 0) {
      logger.info(`Deleting ${response.deprecated.length} deprecated objects from layer "${entry.layerName}"`);
      await layerDataRepository.deleteDeprecatedObjects(entry.layerName, response.deprecated);
    }

    await syncStateRepository.updateOffset(entry.layerName, response.nextRecord);

    if (state.status === SyncStatus.SYNCING && response.objects.length === 0) {
      await syncStateRepository.setStatus(entry.layerName, SyncStatus.READY);
      logger.info(`Layer "${entry.layerName}" initial sync complete - status set to READY`);
    }
  } catch (error) {
    logger.error(`Error processing layer "${entry.layerName}": ${(error as Error).message}`);
  }

  const updatedState = await syncStateRepository.getSyncState(entry.layerName);
  const interval =
    updatedState.status === SyncStatus.SYNCING ? config.syncIntervalMs : config.pollIntervalMs;

  entry.nextRunAt = Date.now() + interval;
}
