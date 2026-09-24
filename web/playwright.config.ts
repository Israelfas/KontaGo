import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta de la web: un navegador de verdad contra el
 * backend y la base de desarrollo (o los de CI).
 *
 * Necesitan el backend en :3000 y la web en :3001 corriendo. Antes de
 * empezar se recarga la tienda demo (e2e/preparar.ts), así cada corrida
 * arranca con los mismos datos. Van de a una: comparten la misma base.
 *
 *   npm run test:e2e              (con los servidores ya levantados)
 *   E2E_SIN_SEED=1 npm run test:e2e   (sin recargar la demo)
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/preparar.ts',
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3001',
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      testIgnore: /celular\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        // En la PC, el Chrome instalado (no hace falta bajar navegadores).
        channel: CI ? undefined : 'chrome',
      },
    },
    {
      name: 'celular',
      testMatch: /celular\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: CI ? undefined : 'chrome' },
    },
  ],
});
