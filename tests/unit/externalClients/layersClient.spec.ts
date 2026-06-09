import type { Logger } from '@map-colonies/js-logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import type { SyncConfig } from '@src/types';

vi.mock('axios');
vi.mock('@src/common/syncConfig', () => ({
  getSyncConfig: vi.fn(),
}));

import { fetchPage } from '@src/externalClients/layersClient/layersClient';
import { getSyncConfig } from '@src/common/syncConfig';

const syncConfig: SyncConfig = {
  layers: [{ name: 'obstacles', query: 'query { obstacles { id } }' }],
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

function rawObject(id: string, kind: string, coords: { latitude: number; longitude: number }[]) {
  return {
    id,
    deleted: false,
    createdBy: null,
    creationTime: null,
    entityVersion: null,
    lastUpdateTime: null,
    lastUpdatedBy: null,
    identifiers: null,
    geography: {
      graphicsObjectKind: { value: kind },
      coordinates: coords,
      height: null,
      obstacleHeightsRange: null,
    },
  };
}

const closedRing = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 1 },
  { latitude: 1, longitude: 1 },
  { latitude: 0, longitude: 0 },
];

// First and last coords differ -> turf polygon() throws
const openRing = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 1 },
  { latitude: 1, longitude: 1 },
  { latitude: 1, longitude: 0 },
];

function mockResponse(layerName: string, rawObjects: ReturnType<typeof rawObject>[]) {
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      data: { [layerName]: rawObjects },
      extensions: { sequence: '11', deletedEntitiesCount: 0, fetchedEntitiesCount: rawObjects.length, deletedEntitiesIds: [] },
    },
  });
}

describe('fetchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSyncConfig).mockReturnValue(syncConfig);
  });

  it('skips the problematic AREA (unclosed ring) and parses every other object', async () => {
    const logger = makeLogger();
    mockResponse('obstacles', [
      rawObject('point-1', 'POINT', [{ latitude: 1, longitude: 2 }]),
      rawObject('area-bad', 'AREA', openRing),
      rawObject('area-good', 'AREA', closedRing),
      rawObject('point-2', 'POINT', [{ latitude: 3, longitude: 4 }]),
    ]);

    const result = await fetchPage(logger, 'obstacles', '10');

    expect(result.objects.map((o) => o.id)).toEqual(['point-1', 'area-good', 'point-2']);
    expect(result.nextSequence).toBe('11');
  });

  it('logs an error for the skipped object', async () => {
    const logger = makeLogger();
    mockResponse('obstacles', [rawObject('point-1', 'POINT', [{ latitude: 1, longitude: 2 }]), rawObject('area-bad', 'AREA', openRing)]);

    await fetchPage(logger, 'obstacles', '10');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ id: 'area-bad', layerName: 'obstacles' }));
  });
});
