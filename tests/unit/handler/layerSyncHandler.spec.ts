import type { Logger } from '@map-colonies/js-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleEntry, SyncConfig, SyncStateEntry, ThirdPartyResponse } from '@src/types';
import { SyncStatus } from '@src/types';

vi.mock('@src/common/syncConfig', () => ({
  getSyncConfig: vi.fn(),
}));

vi.mock('@src/dal/repositories/syncStateRepository', () => ({
  getSyncState: vi.fn(),
  updateSequence: vi.fn(),
  setStatus: vi.fn(),
}));

vi.mock('@src/dal/repositories/layerDataRepository', () => ({
  insertObjects: vi.fn(),
  deleteDeprecatedObjects: vi.fn(),
}));

vi.mock('@src/externalClients/layersClient/layersClient', () => ({
  fetchPage: vi.fn(),
}));

import { fetchAndSyncLayerPage } from '@src/handler/layerSyncHandler';
import { getSyncConfig } from '@src/common/syncConfig';
import * as syncStateRepository from '@src/dal/repositories/syncStateRepository';
import * as layerDataRepository from '@src/dal/repositories/layerDataRepository';
import * as layerClient from '@src/externalClients/layersClient/layersClient';

const syncConfig: SyncConfig = {
  layers: ['obstacles'],
  syncIntervalMs: 500,
  pollIntervalMs: 600_000,
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

function makeState(overrides: Partial<SyncStateEntry> = {}): SyncStateEntry {
  return {
    layerName: 'obstacles',
    status: SyncStatus.SYNCING,
    lastSequence: '0',
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  } as SyncStateEntry;
}

function makeResponse(overrides: Partial<ThirdPartyResponse> = {}): ThirdPartyResponse {
  return {
    nextSequence: '10',
    fetchedCount: 0,
    deletedCount: 0,
    deletedIds: [],
    objects: [],
    ...overrides,
  };
}

describe('layerSyncHandler', () => {
  beforeEach(() => {
    vi.mocked(getSyncConfig).mockReturnValue(syncConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('fetchAndSyncLayerPage', () => {
    it('fetches a page, inserts objects, deletes deprecated ids and updates the sequence', async () => {
      const initialState = makeState({ status: SyncStatus.SYNCING, lastSequence: '5' });
      const afterState = makeState({ status: SyncStatus.SYNCING, lastSequence: '10' });
      vi.mocked(syncStateRepository.getSyncState).mockResolvedValueOnce(initialState).mockResolvedValueOnce(afterState);

      const objects = [{ id: 'a', geom: { type: 'Polygon', coordinates: [] }, properties: {} }] as ThirdPartyResponse['objects'];
      vi.mocked(layerClient.fetchPage).mockResolvedValue(
        makeResponse({ nextSequence: '10', fetchedCount: 1, deletedCount: 1, deletedIds: ['old-1'], objects })
      );

      const entry: ScheduleEntry = { layerName: 'obstacles', nextRunAt: 0 };
      await fetchAndSyncLayerPage(makeLogger(), entry);

      expect(layerClient.fetchPage).toHaveBeenCalledWith(expect.anything(), 'obstacles', '5');
      expect(layerDataRepository.insertObjects).toHaveBeenCalledWith(expect.anything(), 'obstacles', objects);
      expect(layerDataRepository.deleteDeprecatedObjects).toHaveBeenCalledWith('obstacles', ['old-1']);
      expect(syncStateRepository.updateSequence).toHaveBeenCalledWith('obstacles', '10');
    });

    it('skips insertObjects when there are no objects and skips delete when there are no deleted ids', async () => {
      vi.mocked(syncStateRepository.getSyncState).mockResolvedValue(makeState({ status: SyncStatus.READY }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ nextSequence: '11', fetchedCount: 0 }));

      const entry: ScheduleEntry = { layerName: 'obstacles', nextRunAt: 0 };
      await fetchAndSyncLayerPage(makeLogger(), entry);

      expect(layerDataRepository.insertObjects).not.toHaveBeenCalled();
      expect(layerDataRepository.deleteDeprecatedObjects).not.toHaveBeenCalled();
      expect(syncStateRepository.updateSequence).toHaveBeenCalledWith('obstacles', '11');
    });

    it('transitions SYNCING to READY when fetchedCount is 0', async () => {
      vi.mocked(syncStateRepository.getSyncState)
        .mockResolvedValueOnce(makeState({ status: SyncStatus.SYNCING }))
        .mockResolvedValueOnce(makeState({ status: SyncStatus.READY }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ fetchedCount: 0 }));

      await fetchAndSyncLayerPage(makeLogger(), { layerName: 'obstacles', nextRunAt: 0 });

      expect(syncStateRepository.setStatus).toHaveBeenCalledWith('obstacles', SyncStatus.READY);
    });

    it('does not transition status when already READY', async () => {
      vi.mocked(syncStateRepository.getSyncState).mockResolvedValue(makeState({ status: SyncStatus.READY }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ fetchedCount: 0 }));

      await fetchAndSyncLayerPage(makeLogger(), { layerName: 'obstacles', nextRunAt: 0 });

      expect(syncStateRepository.setStatus).not.toHaveBeenCalled();
    });

    it('does not transition to READY when SYNCING returned fetched objects', async () => {
      vi.mocked(syncStateRepository.getSyncState).mockResolvedValue(makeState({ status: SyncStatus.SYNCING }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ fetchedCount: 3 }));

      await fetchAndSyncLayerPage(makeLogger(), { layerName: 'obstacles', nextRunAt: 0 });

      expect(syncStateRepository.setStatus).not.toHaveBeenCalled();
    });

    it('catches errors from fetchPage, logs them, and still schedules next run', async () => {
      vi.mocked(syncStateRepository.getSyncState).mockResolvedValue(makeState({ status: SyncStatus.READY }));
      vi.mocked(layerClient.fetchPage).mockRejectedValue(new Error('boom'));

      const logger = makeLogger();
      const entry: ScheduleEntry = { layerName: 'obstacles', nextRunAt: 0 };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T00:00:00Z'));
      await fetchAndSyncLayerPage(logger, entry);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
      expect(entry.nextRunAt).toBe(Date.now() + syncConfig.pollIntervalMs);
      expect(syncStateRepository.updateSequence).not.toHaveBeenCalled();
    });

    it('schedules next run using syncIntervalMs while SYNCING', async () => {
      vi.mocked(syncStateRepository.getSyncState)
        .mockResolvedValueOnce(makeState({ status: SyncStatus.SYNCING }))
        .mockResolvedValueOnce(makeState({ status: SyncStatus.SYNCING }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ fetchedCount: 2 }));

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T00:00:00Z'));
      const entry: ScheduleEntry = { layerName: 'obstacles', nextRunAt: 0 };
      await fetchAndSyncLayerPage(makeLogger(), entry);

      expect(entry.nextRunAt).toBe(Date.now() + syncConfig.syncIntervalMs);
    });

    it('schedules next run using pollIntervalMs when READY', async () => {
      vi.mocked(syncStateRepository.getSyncState)
        .mockResolvedValueOnce(makeState({ status: SyncStatus.SYNCING }))
        .mockResolvedValueOnce(makeState({ status: SyncStatus.READY }));
      vi.mocked(layerClient.fetchPage).mockResolvedValue(makeResponse({ fetchedCount: 0 }));

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T00:00:00Z'));
      const entry: ScheduleEntry = { layerName: 'obstacles', nextRunAt: 0 };
      await fetchAndSyncLayerPage(makeLogger(), entry);

      expect(entry.nextRunAt).toBe(Date.now() + syncConfig.pollIntervalMs);
    });
  });
});
