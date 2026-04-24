import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface DbConfig extends PostgresConnectionOptions {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
  enableSslAuth?: boolean;
  sslPaths?: {
    ca: string;
    cert: string;
    key: string;
  };
}
