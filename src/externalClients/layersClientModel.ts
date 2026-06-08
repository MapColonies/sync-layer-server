// The query per layer comes from config (sync.layerQueries), keyed by layer name.
// The layer name is the root GraphQL query field. A layer with no configured
// query is treated as a misconfiguration and skipped (error thrown).
export function buildLayerQuery(layerName: string, layerQueries: Record<string, string>): string {
  const query = layerQueries[layerName];
  if (query === undefined || query.trim() === '') {
    throw new Error(`No query configured for layer "${layerName}"`);
  }
  return query;
}
