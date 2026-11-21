import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from './config';
import { ENTITIES } from './entities';
import { join } from 'path';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  entities: ENTITIES,
  migrations: [join(__dirname, 'migrations', '*.js')],
  migrationsRun: true,
  synchronize: false,
};

/** Used by the TypeORM CLI to generate and run migrations. */
export default new DataSource(dataSourceOptions);
