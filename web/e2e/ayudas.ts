import { expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

// Las cuentas de la tienda demo (backend/scripts/seed-demo.mjs).
export const CUENTAS = {
  admin: { email: 'demo@kontago.test', password: 'demo1234', nombre: 'María Salazar' },
  cajero: { email: 'cajero@kontago.test', password: 'demo1234', nombre: 'Pedro Gómez' },
} as const;

type Quien = keyof typeof CUENTAS;

export interface Sesion {
  accessToken: string;
  refreshToken: string;
}

/** Tokens de una cuenta demo, pedidos a la API. */
// Una sesión por cuenta para toda la corrida: el backend limita los logins
// por IP y así las pruebas no lo tocan. Se renueva antes de que venza el
// token de acceso (15 min).
const sesiones = new Map<Quien, { sesion: Sesion; desde: number }>();
const VIGENCIA_MS = 10 * 60_000;

export async function tokensDe(quien: Quien): Promise<Sesion> {
  const guardada = sesiones.get(quien);
  if (guardada && Date.now() - guardada.desde < VIGENCIA_MS) return guardada.sesion;
  const sesion = await entrar(quien);
  sesiones.set(quien, { sesion, desde: Date.now() });
  return sesion;
}

async function entrar(quien: Quien): Promise<Sesion> {
  const { email, password } = CUENTAS[quien];
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`No se pudo entrar como ${quien}: ${r.status} ${await r.text()}`);
  return (await r.json()) as Sesion;
}

/**
 * Deja al navegador con la sesión de esa cuenta, sin pasar por el
 * formulario (el formulario se prueba en login.spec.ts).
 */
export async function entrarComo(page: Page, quien: Quien): Promise<Sesion> {
  const sesion = await tokensDe(quien);
  await page.goto('/login');
  await page.evaluate(({ accessToken, refreshToken }) => {
    localStorage.setItem('kontago.accessToken', accessToken);
    localStorage.setItem('kontago.refreshToken', refreshToken);
  }, sesion);
  return sesion;
}

/** GET a la API con la sesión dada. */
export async function consultar<T>(ruta: string, sesion: Sesion): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${sesion.accessToken}` },
  });
  if (!r.ok) throw new Error(`GET ${ruta}: ${r.status}`);
  return (await r.json()) as T;
}

/** Monto como lo muestra la app: 2040 → "$20,40". */
export const monto = (centavos: number) =>
  `$${(centavos / 100)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** La ventana abierta (dialog) y su título. */
export const ventana = (page: Page) => page.locator('dialog.ventana[open]');

export async function esperarVentana(page: Page, titulo: string | RegExp) {
  await expect(ventana(page).locator('.ventana-titulo')).toHaveText(titulo);
}

/** El número grande de la franja, ya terminado de contar. */
export const valorDeLaFranja = (page: Page) => page.locator('.banda-valor .sr-only');
