import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * DataSource usado por la CLI de TypeORM (`npm run migration:generate`, etc.).
 * La app en runtime usa TypeOrmModule.forRootAsync (ver app.module.ts);
 * este archivo es solo para las migraciones.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'kontago',
  password: process.env.DB_PASSWORD || 'kontago',
  database: process.env.DB_NAME || 'kontago',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
