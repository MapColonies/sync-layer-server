export interface SyncConfig {
  layers: string[];
  syncIntervalMs: number;
  pollIntervalMs: number;
  pageSize: number;
  thirdPartyBaseUrl: string;
  realityId: number;
  requestingSystem: string;
  requestingSystemName: string;
  useDeleteEntities: boolean;
  authToken: string;
  system: {
    name: string;
    details: {
      description: string;
      version: string;
      owner: string;
    };
  };
}
