import { execSync } from 'child_process';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * Una vez antes de todos los tests e2e: borra y vuelve a crear la base de
 * tests y le corre las migraciones (las mismas que en producción, así
 * los tests también prueban que una base nueva se arma bien).
 *
 * Usa el mismo Postgres de desarrollo (docker compose) con otra base:
 * DB_NAME_TEST, o 'kontago_test'. Nunca toca la base de desarrollo.
 */
export default async function prepararBase(): Promise<void> {
  config();
  const baseDeTests = process.env.DB_NAME_TEST || 'kontago_test';
  if (baseDeTests === process.env.DB_NAME) {
    throw new Error(
      'DB_NAME_TEST no puede ser la misma base que DB_NAME: los tests la borran.',
    );
  }

  // Conexión a la base "postgres" (no a la de tests, que se va a borrar).
  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'kontago',
    password: process.env.DB_PASSWORD || 'kontago',
    database: 'postgres',
  });
  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${baseDeTests}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${baseDeTests}"`);
  } finally {
    await admin.destroy();
  }

  execSync('npm run migration:run', {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DB_NAME: baseDeTests },
    stdio: 'ignore',
  });
}
