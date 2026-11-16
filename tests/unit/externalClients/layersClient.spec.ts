import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

import { fetchPage } from '@src/externalClients/layersClient/layersClient';
import { getSyncConfig } from '@src/common/syncConfig';
import { makeLogger, makeSyncConfig } from '@tests/testDefinitions';
import type { RawLayerObject } from '@src/externalClients/layersClient/interfaces';

vi.mock('axios');
vi.mock('@src/common/syncConfig', () => ({
  getSyncConfig: vi.fn(),
}));

const syncConfig = makeSyncConfig(['obstacles']);

function rawObject(id: string, kind: string, coords: { latitude: number; longitude: number }[]): RawLayerObject {
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

  it('should pass obstacleHeightsRange (including value) and identifiers through to properties', async () => {
    const logger = makeLogger();
    const raw = rawObject('point-1', 'POINT', [{ latitude: 1, longitude: 2 }]);
    raw.geography.obstacleHeightsRange = { displayName: 'Range A', value: 'RANGE_A' };
    raw.identifiers = { essence: { displayName: 'Essence A', value: 'ESSENCE_A' }, name: 'n', number: '1' };
    raw.geography.height = 42.5 as unknown as null;
    mockResponse('obstacles', [raw]);

    const result = await fetchPage(logger, 'obstacles', '10');

    expect(result.objects[0]?.properties).toMatchObject({
      height: 42.5,
      obstacleHeightsRange: { displayName: 'Range A', value: 'RANGE_A' },
      identifiers: { essence: { displayName: 'Essence A', value: 'ESSENCE_A' }, name: 'n', number: '1' },
    });
  });
});
