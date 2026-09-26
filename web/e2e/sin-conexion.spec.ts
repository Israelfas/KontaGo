import { expect, test, type Page } from '@playwright/test';
import {
  API,
  consultar,
  entrarComo,
  monto,
  ponerCookieDeSesion,
  tokensDe,
  type Sesion,
} from './ayudas';

/*
 * Vender sin internet: se corta la red con la caja abierta, se sigue
 * cobrando con el catálogo guardado, y al volver la conexión las ventas
 * llegan solas (una sola vez cada una).
 */

const COCA = '7861001234567';

interface Producto {
  codigoBarras: string;
  nombre: string;
  precioVentaCentavos: number;
}

async function pedir(ruta: string, sesion: Sesion, body: object) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`);
}

async function abrirCajaSiHaceFalta(sesion: Sesion) {
  const { turno } = await consultar<{ turno: unknown }>('/caja/actual', sesion);
  if (!turno) await pedir('/caja/abrir', sesion, { fondoInicialCentavos: 2000 });
}

const ventasDeHoy = async (sesion: Sesion) =>
  (await consultar<unknown[]>('/ventas/hoy', sesion)).length;

/** Abre la venta con conexión (así se guarda el catálogo) y corta la red. */
async function venderSinRed(page: Page) {
  await page.goto('/venta');
  await expect(page.locator('#codigo-barras')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('kontago-catalogo-'))),
    )
    .toBe(true);
  await page.context().setOffline(true);
  await expect(page.getByText('Sin conexión · puedes seguir vendiendo')).toBeVisible();
}

async function cobrarCoca(page: Page, coca: Producto) {
  await page.locator('#codigo-barras').fill(COCA);
  await page.locator('#codigo-barras').press('Enter');
  await expect(page.locator('tbody tr', { hasText: coca.nombre })).toHaveCount(1);
  await page.locator('#monto-recibido').fill('5');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(page.getByText('Venta guardada sin conexión')).toBeVisible();
  await expect(page.getByText(monto(500 - coca.precioVentaCentavos))).toBeVisible();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
}

test.describe('Vender sin internet', () => {
  let sesion: Sesion;
  let coca: Producto;

  test.beforeEach(async ({ page }) => {
    sesion = await entrarComo(page, 'cajero');
    await abrirCajaSiHaceFalta(sesion);
    coca = (await consultar<Producto[]>('/productos', sesion)).find(
      (p) => p.codigoBarras === COCA,
    )!;
  });

  test.afterEach(async ({ page }) => {
    await page.context().setOffline(false);
  });

  test('sin red se sigue cobrando, y al volver las ventas llegan solas', async ({ page }) => {
    const antes = await ventasDeHoy(sesion);
    await venderSinRed(page);

    await cobrarCoca(page, coca);
    await cobrarCoca(page, coca);
    await expect(page.getByText(/2 ventas guardadas; se envían solas/)).toBeVisible();
    // Nada llegó al servidor todavía.
    expect(await ventasDeHoy(sesion)).toBe(antes);

    // Vuelve internet: se mandan solas y el aviso se va.
    await page.context().setOffline(false);
    await expect(page.getByText('Sin conexión · puedes seguir vendiendo')).toHaveCount(0);
    await expect.poll(() => ventasDeHoy(sesion)).toBe(antes + 2);
    await expect(page.getByRole('status')).toHaveCount(0);
    // Una sola vez cada una, aunque se vuelva a intentar.
    await page.waitForTimeout(1500);
    expect(await ventasDeHoy(sesion)).toBe(antes + 2);
  });

  test('una venta que el servidor rechaza queda a la vista para decidir', async ({ page }) => {
    const antes = await ventasDeHoy(sesion);
    await venderSinRed(page);
    await cobrarCoca(page, coca);

    // Mientras tanto, la caja se cierra desde otro lado: el servidor ya no
    // la acepta.
    await pedir('/caja/cerrar', sesion, { efectivoContadoCentavos: 0 });
    await page.context().setOffline(false);
    const aviso = page.getByRole('button', { name: /1 venta no se pudo enviar/ });
    await expect(aviso).toBeVisible();

    await aviso.click();
    const ventana = page.locator('dialog.ventana[open]');
    await expect(ventana.getByText(coca.nombre, { exact: false })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await ventana.getByRole('button', { name: 'Descartar' }).click();
    await expect(ventana.getByText('Ya no queda ninguna.')).toBeVisible();
    await ventana.getByRole('button', { name: 'Listo' }).click();
    await expect(aviso).toHaveCount(0);
    expect(await ventasDeHoy(sesion)).toBe(antes);

    await abrirCajaSiHaceFalta(sesion);
  });
  test('si entra otra cuenta, las ventas pendientes no se mandan con ella', async ({ page }) => {
    const admin = await tokensDe('admin');
    const { turno } = await consultar<{ turno: unknown }>('/caja/actual', admin);
    // Con la caja del admin abierta, una venta mandada con su cuenta pasaría.
    if (!turno) await pedir('/caja/abrir', admin, { fondoInicialCentavos: 0 });
    try {
      const antes = await ventasDeHoy(admin);
      await venderSinRed(page);
      await cobrarCoca(page, coca);

      // Sin red, se corta la sesión del cajero y en este navegador queda
      // la del admin (entró otra persona).
      await pedir('/auth/cerrar-sesiones', sesion, {});
      const nueva = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@kontago.test', password: 'demo1234' }),
      });
      await ponerCookieDeSesion(page.context(), ((await nueva.json()) as Sesion).refreshToken);

      await page.context().setOffline(false);
      // La venta del cajero sigue guardada para él y no entró como del admin.
      await page.waitForTimeout(2500);
      expect(await ventasDeHoy(admin)).toBe(antes);
      const guardadas = await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([k]) => k.startsWith('kontago-pendientes-'))
          .map(([, v]) => (JSON.parse(v) as unknown[]).length),
      );
      expect(guardadas).toContain(1);
    } finally {
      if (!turno) await pedir('/caja/cerrar', admin, { efectivoContadoCentavos: 0 });
    }
  });
});
