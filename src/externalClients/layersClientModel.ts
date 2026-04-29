// The third-party API uses the layer name itself as the root query field.
// Pagination/auth inputs are passed via HTTP headers, not GraphQL variables.
// TODO: finalize selection set once the third-party schema is confirmed.
export function buildLayerQuery(layerName: string): string {
  return `query {
  ${layerName} {
    id
    geom
    properties
  }
}`;
}
