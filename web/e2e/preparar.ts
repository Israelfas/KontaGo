import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Antes de todas las pruebas: la tienda demo recién cargada (borra la
 * anterior y la vuelve a armar por la API), así los números de cada
 * corrida son los mismos. Con E2E_SIN_SEED=1 se saltea.
 */
export default async function preparar() {
  const api = process.env.E2E_API_URL ?? 'http://localhost:3000';
  const salud = await fetch(`${api}/health`).catch(() => null);
  if (!salud?.ok) {
    throw new Error(
      `El backend no responde en ${api}. Levantalo (npm run start:dev en backend/) antes de las pruebas.`,
    );
  }
  if (process.env.E2E_SIN_SEED) return;
  execSync('node scripts/seed-demo.mjs', {
    cwd: path.resolve(__dirname, '../../backend'),
    stdio: 'inherit',
    env: { ...process.env, API_URL: api },
  });
}
