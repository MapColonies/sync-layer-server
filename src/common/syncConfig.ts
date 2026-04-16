import type { SyncConfig } from '../types';
import { getConfig } from './config';

export function getSyncConfig(): SyncConfig {
  return getConfig().get('sync') as SyncConfig;
}
