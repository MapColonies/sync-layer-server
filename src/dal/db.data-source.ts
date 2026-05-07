/* istanbul ignore file */
import path from 'node:path';

import { DataSource, type DataSourceOptions } from 'typeorm';
import { getDbConfig } from '../common/dbConfig';
import { initConfig } from '../common/config';
import { createConnectionOptions } from './connectionOptions';

const buildConnectionOptions = (): DataSourceOptions => {
  const options = createConnectionOptions(getDbConfig());
  return {
    ...options,
    migrations: [path.join(__dirname, 'migrations', '*.ts')],
  };
};

/* eslint-disable @typescript-eslint/naming-convention */
export default initConfig(true).then(() => new DataSource(buildConnectionOptions()));
