import type { Logger } from '@map-colonies/js-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleEntry, SyncConfig } from '@src/types';
import { SyncStatus } from '@src/types';

vi.mock('@src/common/syncConfig', () => ({ getSyncConfig: vi.fn() }));
vi.mock('@src/dal/repositories/syncStateRepository', () => ({
  initializeSyncState: vi.fn(),
  getAllSyncStates: vi.fn(),
}));
vi.mock('@src/handler/layerSyncHandler', () => ({
  fetchAndSyncLayerPage: vi.fn(),
}));

import { SyncManager } from '@src/scheduler/syncManager';
import { getSyncConfig } from '@src/common/syncConfig';
import * as syncStateRepository from '@src/dal/repositories/syncStateRepository';
import * as layerSyncHandler from '@src/handler/layerSyncHandler';

const syncConfig: SyncConfig = {
  layers: ['a', 'b'],
  syncIntervalMs: 10,
  pollIntervalMs: 1_000_000,
  pageSize: 100,
  thirdPartyBaseUrl: 'https://example.test/graphql',
  realityId: 1,
  requestingSystem: 'sync-layer-server_test',
  requestingSystemName: 'sync-layer-server',
  useDeleteEntities: true,
  authToken: 'token',
  system: { name: 'sync-layer-server', details: { description: '', version: '0.0.0', owner: 'libot' } },
};

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function makeStateRow(layerName: string): { layerName: string; status: SyncStatus; lastSequence: string; updatedAt: Date } {
  return { layerName, status: SyncStatus.SYNCING, lastSequence: '0', updatedAt: new Date() };
}

describe('integration: SyncManager', () => {
  beforeEach(() => {
    vi.mocked(getSyncConfig).mockReturnValue(syncConfig);
    vi.mocked(syncStateRepository.initializeSyncState).mockResolvedValue(undefined);
    vi.mocked(syncStateRepository.getAllSyncStates).mockResolvedValue([makeStateRow('a'), makeStateRow('b')]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('initializes sync state, processes each layer at least once, then stops cleanly', async () => {
    vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mockImplementation(async (_logger, entry: ScheduleEntry) => {
      entry.nextRunAt = Date.now() + 10_000_000;
      return Promise.resolve();
    });

    const manager = new SyncManager(makeLogger());
    await manager.start();

    await vi.waitFor(
      () => {
        const processed = vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mock.calls.map((c) => (c[1] as ScheduleEntry).layerName);
        expect(processed).toContain('a');
        expect(processed).toContain('b');
      },
      { timeout: 2000, interval: 10 }
    );

    await manager.stop();

    expect(syncStateRepository.initializeSyncState).toHaveBeenCalledWith(['a', 'b']);
    expect(syncStateRepository.getAllSyncStates).toHaveBeenCalledTimes(1);
  });

  it('processes the entry with the smaller nextRunAt first when re-scheduling', async () => {
    const seen: string[] = [];
    vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mockImplementation(async (_logger, entry: ScheduleEntry) => {
      seen.push(entry.layerName);
      // Layer 'a' gets pushed far into the future; layer 'b' re-runs soon.
      // After both have had their first turn, the heap must pop 'b' next because it has the smaller nextRunAt.
      entry.nextRunAt = Date.now() + (entry.layerName === 'a' ? 10_000_000 : 20);
      return Promise.resolve();
    });

    const manager = new SyncManager(makeLogger());
    await manager.start();

    await vi.waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(3), { timeout: 2000, interval: 10 });

    await manager.stop();

    expect(seen.slice(0, 2).sort()).toEqual(['a', 'b']);
    expect(seen[2]).toBe('b');
  });
});
