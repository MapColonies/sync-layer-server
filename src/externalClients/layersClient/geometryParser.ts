import type { Geometry, Position } from 'geojson';

export interface RawCoordinate {
  latitude: number;
  longitude: number;
}

export interface RawGeography {
  coordinates: RawCoordinate[];
  graphicsObjectKind: { value: string };
}

const MULTI_KINDS = new Set(['MULTIPOINT', 'MULTILINE', 'MULTILINESTRING', 'MULTIPOLYGON']);

function toPosition(c: RawCoordinate): Position {
  return [c.longitude, c.latitude];
}

export function geographyToGeoJSON(geography: RawGeography): Geometry {
  const kind = geography.graphicsObjectKind.value.toUpperCase();
  const coords = geography.coordinates;

  if (coords.length === 0) {
    throw new Error(`Empty coordinates for graphicsObjectKind=${kind}`);
  }

  switch (kind) {
    case 'POINT':
      return { type: 'Point', coordinates: toPosition(coords[0]!) };

    case 'LINE':
    case 'LINESTRING':
      if (coords.length < 2) {
        throw new Error(`LineString requires >=2 coordinates, got ${coords.length}`);
      }
      return { type: 'LineString', coordinates: coords.map(toPosition) };

    case 'POLYGON':
      if (coords.length < 4) {
        throw new Error(`Polygon requires >=4 coordinates (closed ring), got ${coords.length}`);
      }
      return { type: 'Polygon', coordinates: [coords.map(toPosition)] };

    default:
      if (MULTI_KINDS.has(kind)) {
        throw new Error(`Unsupported graphicsObjectKind=${kind}: MULTI* encoding not yet documented`);
      }
      throw new Error(`Unknown graphicsObjectKind=${kind}`);
  }
}
