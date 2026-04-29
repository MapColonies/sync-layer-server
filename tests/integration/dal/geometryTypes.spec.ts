import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { DataSource, Repository } from 'typeorm';
import type { Geometry } from 'geojson';
import { LayerObjectEntity } from '@src/dal/entities/layerObject';
import { createDataSourceFromTestEnv } from '@tests/configurations/dbFromProcessEnv';

const TEST_LAYER = 'geometry_types_test';

interface GeomCase {
  name: string;
  expectedType: string;
  geom: Geometry;
}

const cases: GeomCase[] = [
  {
    name: 'point',
    expectedType: 'POINT',
    geom: { type: 'Point', coordinates: [10, 20] },
  },
  {
    name: 'multipoint',
    expectedType: 'MULTIPOINT',
    geom: {
      type: 'MultiPoint',
      coordinates: [
        [10, 20],
        [30, 40],
      ],
    },
  },
  {
    name: 'linestring',
    expectedType: 'LINESTRING',
    geom: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    },
  },
  {
    name: 'multilinestring',
    expectedType: 'MULTILINESTRING',
    geom: {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ],
    },
  },
  {
    name: 'polygon',
    expectedType: 'POLYGON',
    geom: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  },
  {
    name: 'multipolygon',
    expectedType: 'MULTIPOLYGON',
    geom: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
        [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 3],
            [2, 2],
          ],
        ],
      ],
    },
  },
];

describe('integration: layer_objects accepts every PostGIS geometry subtype', () => {
  let ds: DataSource;
  let repo: Repository<LayerObjectEntity>;

  beforeAll(async () => {
    ds = createDataSourceFromTestEnv([LayerObjectEntity]);
    await ds.initialize();
    await ds.query(`CREATE TABLE IF NOT EXISTS "layer_${TEST_LAYER}" PARTITION OF layer_objects FOR VALUES IN ('${TEST_LAYER}')`);
    repo = ds.getRepository(LayerObjectEntity);
  });

  afterEach(async () => {
    await repo.delete({ layerName: TEST_LAYER });
  });

  afterAll(async () => {
    await ds.query(`DROP TABLE IF EXISTS "layer_${TEST_LAYER}"`);
    await ds.destroy();
  });

  it.each(cases)('inserts and reads back a $name', async ({ name, expectedType, geom }) => {
    await repo.insert({ layerName: TEST_LAYER, id: name, geom, properties: { name } });

    const rows = (await ds.query(`SELECT GeometryType(geom) AS gt FROM layer_objects WHERE layer_name = $1 AND id = $2`, [TEST_LAYER, name])) as {
      gt: string;
    }[];

    expect(rows).toHaveLength(1);
    expect(rows[0]?.gt).toBe(expectedType);
  });

  it('keeps all 6 subtypes in the same partition simultaneously', async () => {
    await repo.insert(cases.map((c) => ({ layerName: TEST_LAYER, id: c.name, geom: c.geom, properties: {} })));

    const rows = (await ds.query(`SELECT GeometryType(geom) AS gt FROM layer_objects WHERE layer_name = $1 ORDER BY id`, [TEST_LAYER])) as {
      gt: string;
    }[];

    expect(rows.map((r) => r.gt).sort()).toEqual(cases.map((c) => c.expectedType).sort());
  });
});
