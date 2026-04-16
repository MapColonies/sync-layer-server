import { SyncStatus, type SyncStateEntry } from '../entities';

// TODO: migrate to DB table `sync_state` - currently in-memory (resets on restart)
const state = new Map<string, SyncStateEntry>();

export function initializeSyncState(layers: string[]): void {
  for (const layerName of layers) {
    if (!state.has(layerName)) {
      state.set(layerName, {
        layerName,
        status: SyncStatus.SYNCING,
        lastOffset: 0,
        updatedAt: new Date(),
      });
    }
  }
}

export function getSyncState(layerName: string): SyncStateEntry {
  const entry = state.get(layerName);
  if (!entry) {
    throw new Error(`No sync state found for layer "${layerName}"`);
  }
  return entry;
}

export function getAllSyncStates(): SyncStateEntry[] {
  return [...state.values()];
}

export function updateOffset(layerName: string, newOffset: number): void {
  const entry = getSyncState(layerName);
  entry.lastOffset = newOffset;
  entry.updatedAt = new Date();
  // TODO: persist to DB - UPDATE sync_state SET last_offset = $1, updated_at = $2 WHERE layer_name = $3
}

export function setStatus(layerName: string, status: SyncStatus): void {
  const entry = getSyncState(layerName);
  entry.status = status;
  entry.updatedAt = new Date();
  // TODO: persist to DB - UPDATE sync_state SET status = $1, updated_at = $2 WHERE layer_name = $3
}
