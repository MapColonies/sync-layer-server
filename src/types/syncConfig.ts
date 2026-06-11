import type { LayerConfig } from './layerConfig';

export interface SyncConfig {
  // Layers to sync; each entry pairs a layer name with its GraphQL query.
  layers: LayerConfig[];
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
