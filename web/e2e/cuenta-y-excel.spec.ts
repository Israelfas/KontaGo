import { expect, test } from '@playwright/test';
import { API, entrarComo, tokensDe } from './ayudas';

const CLAVE = 'una frase segura';

test.describe('Reporte en Excel', () => {
  test('el admin baja el Excel del período desde el Resumen', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: '7 días' }).click();
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(
      /^kontago-minimarket-la-esquina-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    // Un .xlsx es un zip: empieza con "PK".
    const ruta = await archivo.path();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(ruta).subarray(0, 2).toString()).toBe('PK');
  });

  test('también desde Ventas; el cajero no lo ve', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/ventas');
    await expect(page.getByRole('button', { name: 'Excel' })).toBeVisible();

    await entrarComo(page, 'cajero');
    await page.goto('/ventas');
    await expect(page.getByRole('heading', { name: 'Ventas del día' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excel' })).toHaveCount(0);
  });
});

test.describe('Menú de la cuenta', () => {
  test('muestra quién está adentro y se cierra con Escape', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/productos');
    await page.getByRole('button', { name: /Tu cuenta/ }).click();
    await expect(page.getByText('demo@kontago.test')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('demo@kontago.test')).toHaveCount(0);
  });

  test('un cajero cierra su sesión en todos sus dispositivos', async ({ page }) => {
    // Un cajero propio de esta prueba: cerrarle las sesiones al cajero de
    // la demo dejaría sin sesión a las demás pruebas.
    const admin = await tokensDe('admin');
    const email = `cajero-sesiones-${Date.now()}@kontago.test`;
    const alta = await fetch(`${API}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ nombre: 'Marta Cajera', email, password: CLAVE }),
    });
    expect(alta.ok).toBe(true);
    const entrar = () =>
      fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: CLAVE }),
      }).then((r) => r.json() as Promise<{ accessToken: string; refreshToken: string }>);
    // Dos dispositivos: este navegador y "otro celular".
    const aca = await entrar();
    const otro = await entrar();

    await page.goto('/login');
    await page.evaluate(({ accessToken, refreshToken }) => {
      localStorage.setItem('kontago.accessToken', accessToken);
      localStorage.setItem('kontago.refreshToken', refreshToken);
    }, aca);
    await page.goto('/ventas');
    await page.getByRole('button', { name: /Tu cuenta: Marta Cajera/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión en todos mis dispositivos' }).click();
    await expect(page.getByText('también aquí')).toBeVisible();
    await page.getByRole('button', { name: 'Sí, cerrar todas' }).click();
    await expect(page).toHaveURL(/\/login/);

    // El "otro celular" también quedó afuera: su acceso y su renovación ya no sirven.
    const perfil = await fetch(`${API}/auth/perfil`, {
      headers: { Authorization: `Bearer ${otro.accessToken}` },
    });
    expect(perfil.status).toBe(401);
    const renovar = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: otro.refreshToken }),
    });
    expect(renovar.status).toBe(401);
  });
});
