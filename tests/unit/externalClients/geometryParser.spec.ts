import { describe, expect, it } from 'vitest';
import { geographyToGeoJSON, type RawGeography } from '@src/externalClients/layersClient/geometryParser';

function geo(kind: string, coords: { latitude: number; longitude: number }[]): RawGeography {
  return { coordinates: coords, graphicsObjectKind: { value: kind } };
}

describe('geographyToGeoJSON', () => {
  describe('POINT', () => {
    it('maps single coordinate to Point with [lng, lat] order', () => {
      const result = geographyToGeoJSON(geo('POINT', [{ latitude: 32.0853, longitude: 34.7818 }]));
      expect(result).toEqual({ type: 'Point', coordinates: [34.7818, 32.0853] });
    });

    it('accepts lowercase kind', () => {
      const result = geographyToGeoJSON(geo('point', [{ latitude: 1, longitude: 2 }]));
      expect(result).toEqual({ type: 'Point', coordinates: [2, 1] });
    });
  });

  describe('LINE / LINESTRING', () => {
    it('maps 2+ coords to LineString in [lng, lat] order', () => {
      const result = geographyToGeoJSON(
        geo('LINE', [
          { latitude: 32.7453754, longitude: 35.1867382 },
          { latitude: 32.7454701, longitude: 35.1854494 },
        ])
      );
      expect(result).toEqual({
        type: 'LineString',
        coordinates: [
          [35.1867382, 32.7453754],
          [35.1854494, 32.7454701],
        ],
      });
    });

    it('accepts LINESTRING alias', () => {
      const result = geographyToGeoJSON(
        geo('LINESTRING', [
          { latitude: 1, longitude: 2 },
          { latitude: 3, longitude: 4 },
        ])
      );
      expect(result.type).toBe('LineString');
    });

    it('throws when fewer than 2 coords', () => {
      expect(() => geographyToGeoJSON(geo('LINE', [{ latitude: 1, longitude: 2 }]))).toThrow(/LineString requires >=2/);
    });
  });

  describe('POLYGON', () => {
    it('wraps closed ring in single-element outer array', () => {
      const ring = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 0 },
      ];
      const result = geographyToGeoJSON(geo('POLYGON', ring));
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      });
    });

    it('throws when fewer than 4 coords', () => {
      const ring = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 0 },
      ];
      expect(() => geographyToGeoJSON(geo('POLYGON', ring))).toThrow(/Polygon requires >=4/);
    });

    it('accepts AREA alias as Polygon', () => {
      const ring = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 0 },
      ];
      const result = geographyToGeoJSON(geo('AREA', ring));
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      });
    });
  });

  describe('error cases', () => {
    it('throws on empty coordinates', () => {
      expect(() => geographyToGeoJSON(geo('POINT', []))).toThrow(/Empty coordinates/);
    });

    it.each(['MULTIPOINT', 'MULTILINE', 'MULTILINESTRING', 'MULTIPOLYGON'])('throws unsupported for %s', (kind) => {
      expect(() => geographyToGeoJSON(geo(kind, [{ latitude: 1, longitude: 2 }]))).toThrow(/Unsupported graphicsObjectKind/);
    });

    it('throws on unknown kind', () => {
      expect(() => geographyToGeoJSON(geo('TRIANGLE', [{ latitude: 1, longitude: 2 }]))).toThrow(/Unknown graphicsObjectKind=TRIANGLE/);
    });
  });
});
