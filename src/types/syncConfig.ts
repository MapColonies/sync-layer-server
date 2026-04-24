export interface SyncConfig {
  layers: string[];
  syncIntervalMs: number;
  pollIntervalMs: number;
  pageSize: number;
  thirdPartyBaseUrl: string;
  auth: {
    token: string;
  };
  system: {
    name: string;
    details: {
      description: string;
      version: string;
      owner: string;
    };
  };
}
