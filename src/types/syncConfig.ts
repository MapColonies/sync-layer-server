export interface SyncConfig {
  layers: string[];
  syncIntervalMs: number;
  pollIntervalMs: number;
  pageSize: number;
  thirdPartyBaseUrl: string;
}
