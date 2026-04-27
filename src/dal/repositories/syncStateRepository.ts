import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { Repository } from 'typeorm';
import { SyncStatus, SyncStateEntry } from '../entities';
import { getDataSource } from '../connection';
import { SERVICE_NAME } from '../../common/constants';

const tracer = trace.getTracer(SERVICE_NAME);

function getRepository(): Repository<SyncStateEntry> {
  return getDataSource().getRepository(SyncStateEntry);
}

export async function initializeSyncState(layers: string[]): Promise<void> {
  await asyncCallWithSpan(
    async () => {
      const repo = getRepository();
      for (const layerName of layers) {
        await repo
          .createQueryBuilder()
          .insert()
          .into(SyncStateEntry)
          .values({ layerName, status: SyncStatus.SYNCING, lastSequence: '0' })
          .orIgnore()
          .execute();
      }
    },
    tracer,
    'syncStateRepository.initializeSyncState'
  );
}

export async function getSyncState(layerName: string): Promise<SyncStateEntry> {
  const entry = await getRepository().findOneBy({ layerName });
  if (!entry) {
    throw new Error(`No sync state found for layer "${layerName}"`);
  }
  return entry;
}

export async function getAllSyncStates(): Promise<SyncStateEntry[]> {
  return getRepository().find();
}

export async function updateSequence(layerName: string, newSequence: string): Promise<void> {
  await getRepository().update({ layerName }, { lastSequence: newSequence });
}

export async function setStatus(layerName: string, status: SyncStatus): Promise<void> {
  await getRepository().update({ layerName }, { status });
}
