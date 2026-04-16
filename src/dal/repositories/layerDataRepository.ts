import type { DeprecatedObject, LayerObject } from '../entities';

export function insertObjects(_layerName: string, _objects: LayerObject[]): void {
  // TODO: INSERT ... ON CONFLICT (upsert) into the remote DB layer table
}

export function updateDeprecatedObjects(_layerName: string, _deprecated: DeprecatedObject[]): void {
  // TODO: UPDATE with JSONB merge against the remote DB
}
