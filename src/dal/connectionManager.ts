import { injectable } from 'tsyringe';
import { getDataSource } from './connection';

@injectable()
export class ConnectionManager {
  public async healthCheck(): Promise<void> {
    await getDataSource().query('SELECT 1');
  }
}

export type HealthCheck = () => Promise<void>;
