import type { Logger } from '@map-colonies/js-logger';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleEntry, SyncConfig } from '@src/types';

import { SyncManager } from '@src/scheduler/syncManager';
import { getTestDbConfigFromEnv } from '@tests/configurations/dbFromProcessEnv';
import { getSyncConfig } from '@src/common/syncConfig';
import { getDbConfig } from '@src/common/dbConfig';
import { closeDb, getDataSource, initializeDb } from '@src/dal/connection';
import { getAllSyncStates } from '@src/dal/repositories/syncStateRepository';
import { SyncStateEntry } from '@src/dal/entities/syncState';
import { SyncStatus } from '@src/types';
import * as layerSyncHandler from '@src/handler/layerSyncHandler';

vi.mock('@src/common/syncConfig', () => ({ getSyncConfig: vi.fn() }));
vi.mock('@src/common/dbConfig', () => ({ getDbConfig: vi.fn() }));
vi.mock('@src/handler/layerSyncHandler', () => ({
  fetchAndSyncLayerPage: vi.fn(),
}));

const TEST_LAYERS = ['layer_alpha', 'layer_beta'];

const syncConfig: SyncConfig = {
  layers: TEST_LAYERS.map((layer) => ({ name: layer, query: `query { ${layer} { id } }` })),
  syncIntervalMs: 10,
  pollIntervalMs: 1_000_000,
  pageSize: 100,
  thirdPartyBaseUrl: 'https://example.test/graphql',
  realityId: 1,
  requestingSystem: 'sync-layer-server_test',
  requestingSystemName: 'sync-layer-server',
  useDeleteEntities: true,
  authToken: 'token',
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

describe('integration: SyncManager', () => {
  beforeAll(async () => {
    vi.mocked(getDbConfig).mockReturnValue(getTestDbConfigFromEnv());

    await initializeDb(TEST_LAYERS);
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    vi.mocked(getSyncConfig).mockReturnValue(syncConfig);
    await getDataSource().getRepository(SyncStateEntry).clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('persists sync state rows in the DB and processes each layer at least once', async () => {
    vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mockImplementation(async (_logger, entry: ScheduleEntry) => {
      entry.nextRunAt = Date.now() + 10_000_000;
      return Promise.resolve();
    });

    const manager = new SyncManager(makeLogger());
    await manager.start();

    await vi.waitFor(
      () => {
        const processed = vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mock.calls.map((c) => c[1].layerName);

        expect(processed).toContain('layer_alpha');
        expect(processed).toContain('layer_beta');
      },
      { timeout: 2000, interval: 10 }
    );

    await manager.stop();

    const stored = await getAllSyncStates();
    const byName = Object.fromEntries(stored.map((s) => [s.layerName, s]));

    expect(stored).toHaveLength(2);
    expect(byName['layer_alpha']?.status).toBe(SyncStatus.SYNCING);
    expect(byName['layer_alpha']?.lastSequence).toBe('0');
    expect(byName['layer_beta']?.status).toBe(SyncStatus.SYNCING);
    expect(byName['layer_beta']?.lastSequence).toBe('0');
  });

  it('processes the entry with the smaller nextRunAt first when re-scheduling', async () => {
    const seen: string[] = [];
    vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mockImplementation(async (_logger, entry: ScheduleEntry) => {
      seen.push(entry.layerName);
      entry.nextRunAt = Date.now() + (entry.layerName === 'layer_alpha' ? 10_000_000 : 20);
      return Promise.resolve();
    });

    const manager = new SyncManager(makeLogger());
    await manager.start();

    await vi.waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(3), { timeout: 2000, interval: 10 });

    await manager.stop();

    expect(seen.slice(0, 2).sort()).toEqual(['layer_alpha', 'layer_beta']);
    expect(seen[2]).toBe('layer_beta');
  });

  it('initializeSyncState is idempotent across runs (orIgnore)', async () => {
    vi.mocked(layerSyncHandler.fetchAndSyncLayerPage).mockImplementation(async (_logger, entry: ScheduleEntry) => {
      entry.nextRunAt = Date.now() + 10_000_000;
      return Promise.resolve();
    });

    const first = new SyncManager(makeLogger());
    await first.start();
    await vi.waitFor(
      async () => {
        const rows = await getAllSyncStates();

        expect(rows).toHaveLength(2);
      },
      { timeout: 2000, interval: 20 }
    );
    await first.stop();

    const second = new SyncManager(makeLogger());
    await second.start();
    await second.stop();

    const stored = await getAllSyncStates();

    expect(stored).toHaveLength(2);
  });
});
