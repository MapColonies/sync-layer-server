import type { LayerConfig } from '../types';

// The query per layer comes from config (sync.layers), matched by layer name.
// The layer name is the root GraphQL query field. A layer with no configured
// query is treated as a misconfiguration and skipped (error thrown).
export function buildLayerQuery(layerName: string, layers: LayerConfig[]): string {
  const layer = layers.find((l) => l.name === layerName);
  if (layer === undefined || layer.query.trim() === '') {
    throw new Error(`No query configured for layer "${layerName}"`);
  }
  return layer.query;
}
