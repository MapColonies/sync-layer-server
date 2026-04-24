import type { DbConfig } from '../types';
import { getConfig } from './config';

export function getDbConfig(): DbConfig {
  return getConfig().get('db') as DbConfig;
}
