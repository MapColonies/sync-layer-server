import { point, lineString, polygon } from '@turf/helpers';
import type { Geometry, LineString, Point, Polygon, Position } from 'geojson';

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
      return point(toPosition(coords[0]!)).geometry;

    case 'LINE':
    case 'LINESTRING':
      if (coords.length < 2) {
        throw new Error(`LineString requires >=2 coordinates, got ${coords.length}`);
      }
      return lineString(coords.map(toPosition)).geometry;

    case 'POLYGON':
    case 'AREA':
      if (coords.length < 4) {
        throw new Error(`Polygon requires >=4 coordinates (closed ring), got ${coords.length}`);
      }
      return polygon([coords.map(toPosition)]).geometry;

    default:
      if (MULTI_KINDS.has(kind)) {
        throw new Error(`Unsupported graphicsObjectKind=${kind}: MULTI* encoding not yet documented`);
      }
      throw new Error(`Unknown graphicsObjectKind=${kind}`);
  }
}
