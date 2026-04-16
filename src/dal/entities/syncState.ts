export enum SyncStatus {
  SYNCING = 'SYNCING',
  READY = 'READY',
}

export interface SyncStateEntry {
  layerName: string;
  status: SyncStatus;
  lastOffset: number;
  updatedAt: Date;
}
