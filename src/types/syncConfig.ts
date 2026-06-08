export interface SyncConfig {
  // Layers to sync, keyed by layer name; the value is the GraphQL query for that layer.
  layerQueries: Record<string, string>;
  syncIntervalMs: number;
  pollIntervalMs: number;
  pageSize: number;
  thirdPartyBaseUrl: string;
  realityId: number;
  requestingSystem: string;
  requestingSystemName: string;
  useDeleteEntities: boolean;
  authToken: string;
}
