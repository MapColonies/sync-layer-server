import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

import { fetchPage } from '@src/externalClients/layersClient/layersClient';
import { insertObjects } from '@src/dal/repositories/layerDataRepository';
import { closeDb, getDataSource, initializeDb } from '@src/dal/connection';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { getSyncConfig } from '@src/common/syncConfig';
import { getDbConfig } from '@src/common/dbConfig';
import { getTestDbConfigFromEnv } from '@tests/configurations/dbFromProcessEnv';
import { makeLogger, makeSyncConfig } from '@tests/testDefinitions';

vi.mock('axios');
vi.mock('@src/common/syncConfig', () => ({ getSyncConfig: vi.fn() }));
vi.mock('@src/common/dbConfig', () => ({ getDbConfig: vi.fn() }));

const TEST_LAYER = 'properties_test';

const syncConfig = makeSyncConfig([TEST_LAYER]);

interface RawObstacleOverrides {
  height?: number | null;
  obstacleHeightsRange?: { displayName: string | null; value: string | null } | null;
}

function rawObstacle(id: string, overrides: RawObstacleOverrides = {}) {
  return {
    id,
    deleted: false,
    createdBy: 'creator',
    creationTime: '2026-01-01T00:00:00Z',
    entityVersion: 3,
    lastUpdateTime: '2026-01-02T00:00:00Z',
    lastUpdatedBy: 'updater',
    identifiers: { essence: { displayName: 'Essence A', value: 'ESSENCE_A' }, name: 'obstacle', number: '17' },
    geography: {
      graphicsObjectKind: { value: 'POINT' },
      coordinates: [{ latitude: 32, longitude: 35 }],
      height: 'height' in overrides ? overrides.height : 42.5,
      obstacleHeightsRange: 'obstacleHeightsRange' in overrides ? overrides.obstacleHeightsRange : { displayName: 'Range', value: 'RANGE_A' },
    },
  };
}

function mockThirdParty(rawObjects: ReturnType<typeof rawObstacle>[]): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      data: { [TEST_LAYER]: rawObjects },
      extensions: { sequence: '1', deletedEntitiesCount: 0, fetchedEntitiesCount: rawObjects.length },
    },
  });
}

async function readProperties(id: string): Promise<Record<string, unknown> | undefined> {
  const row = await getDataSource().getRepository(LayerObjectEntity).findOneBy({ layerName: TEST_LAYER, id });
  return row?.properties;
}

async function syncAndReadProperties(overrides: RawObstacleOverrides): Promise<Record<string, unknown> | undefined> {
  mockThirdParty([rawObstacle('obstacle-1', overrides)]);
  const { objects } = await fetchPage(makeLogger(), TEST_LAYER, '0');
  await insertObjects(makeLogger(), TEST_LAYER, objects);
  return readProperties('obstacle-1');
}

describe('integration: layer object properties are persisted to the properties column', () => {
  const logger = makeLogger();

  beforeAll(async () => {
    vi.mocked(getDbConfig).mockReturnValue(getTestDbConfigFromEnv());
    await initializeDb([TEST_LAYER]);
  });

  beforeEach(() => {
    vi.mocked(getSyncConfig).mockReturnValue(syncConfig);
  });

  afterEach(async () => {
    await getDataSource().getRepository(LayerObjectEntity).delete({ layerName: TEST_LAYER });
  });

  afterAll(async () => {
    await getDataSource().query(`DROP TABLE IF EXISTS "layer_${TEST_LAYER}"`);
    await closeDb();
  });

  it('should store the fetched object properties, including obstacleHeightsRange.value, in the DB', async () => {
    mockThirdParty([rawObstacle('obstacle-1')]);

    const { objects } = await fetchPage(logger, TEST_LAYER, '0');
    await insertObjects(logger, TEST_LAYER, objects);

    const properties = await readProperties('obstacle-1');

    expect(properties).toEqual({
      createdBy: 'creator',
      creationTime: '2026-01-01T00:00:00Z',
      entityVersion: 3,
      graphicsObjectKind: { value: 'POINT' },
      height: 42.5,
      obstacleHeightsRange: { displayName: 'Range', value: 'RANGE_A' },
      identifiers: { essence: { displayName: 'Essence A', value: 'ESSENCE_A' }, name: 'obstacle', number: '17' },
      lastUpdateTime: '2026-01-02T00:00:00Z',
      lastUpdatedBy: 'updater',
    });
  });

  it('should overwrite properties in the DB when the same object is synced again', async () => {
    mockThirdParty([rawObstacle('obstacle-1')]);
    await insertObjects(logger, TEST_LAYER, (await fetchPage(logger, TEST_LAYER, '0')).objects);

    mockThirdParty([rawObstacle('obstacle-1', { obstacleHeightsRange: { displayName: 'Range', value: 'RANGE_B' } })]);
    await insertObjects(logger, TEST_LAYER, (await fetchPage(logger, TEST_LAYER, '1')).objects);

    const properties = await readProperties('obstacle-1');

    expect(properties?.obstacleHeightsRange).toEqual({ displayName: 'Range', value: 'RANGE_B' });
  });

  it('should store identifiers.essence.value in the DB', async () => {
    const properties = await syncAndReadProperties({});

    expect(properties?.identifiers).toEqual({ essence: { displayName: 'Essence A', value: 'ESSENCE_A' }, name: 'obstacle', number: '17' });
  });

  it.each([
    { case: 'a decimal number', height: 42.5 },
    { case: 'an integer', height: 100 },
    { case: 'null', height: null },
  ])('should store geography.height in the DB when it is $case', async ({ height }) => {
    const properties = await syncAndReadProperties({ height });

    expect(properties).toHaveProperty('height', height);
  });

  it('should store obstacleHeightsRange in the DB when it is null', async () => {
    const properties = await syncAndReadProperties({ obstacleHeightsRange: null });

    expect(properties).toHaveProperty('obstacleHeightsRange', null);
  });

  it.each([
    { case: 'text', value: 'RANGE_C' },
    { case: 'null', value: null },
  ])('should store obstacleHeightsRange.value in the DB when it is $case', async ({ value }) => {
    const properties = await syncAndReadProperties({ obstacleHeightsRange: { displayName: 'Range', value } });

    expect(properties?.obstacleHeightsRange).toEqual({ displayName: 'Range', value });
  });
});
