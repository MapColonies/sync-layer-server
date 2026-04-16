import type { Repository } from 'typeorm';
import { SyncStatus, SyncStateEntry } from '../entities';
import { getDataSource } from '../connection';

function getRepository(): Repository<SyncStateEntry> {
  return getDataSource().getRepository(SyncStateEntry);
}

export async function initializeSyncState(layers: string[]): Promise<void> {
  const repo = getRepository();
  for (const layerName of layers) {
    await repo
      .createQueryBuilder()
      .insert()
      .into(SyncStateEntry)
      .values({ layerName, status: SyncStatus.SYNCING, lastOffset: 0 })
      .orIgnore()
      .execute();
  }
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

export async function updateOffset(layerName: string, newOffset: number): Promise<void> {
  await getRepository().update({ layerName }, { lastOffset: newOffset });
}

export async function setStatus(layerName: string, status: SyncStatus): Promise<void> {
  await getRepository().update({ layerName }, { status });
}
