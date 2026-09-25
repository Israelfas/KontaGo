import { expect, test } from '@playwright/test';
import { API, consultar, entrarComo, tokensDe, type Sesion } from './ayudas';

/*
 * Lo que no trae código de barras (pan, huevos, lo suelto): se carga sin
 * código y en la caja se encuentra por su nombre, o con un toque.
 */

async function pedir(ruta: string, sesion: Sesion, body: object) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<{ codigoBarras: string; nombre: string }>;
}

async function abrirCajaSiHaceFalta(sesion: Sesion) {
  const { turno } = await consultar<{ turno: unknown }>('/caja/actual', sesion);
  if (!turno) await pedir('/caja/abrir', sesion, { fondoInicialCentavos: 2000 });
}

test.describe('Productos sin código de barras', () => {
  const nombre = `Pan de yuca ${Date.now() % 100000}`;

  test.beforeAll(async () => {
    const pan = await pedir('/productos', await tokensDe('admin'), {
      nombre,
      precioVentaCentavos: 25,
      stockInicial: 40,
    });
    expect(pan.codigoBarras).toMatch(/^20\d{11}$/);
  });

  test('en la caja se encuentra por el nombre y con un toque', async ({ page }) => {
    const sesion = await entrarComo(page, 'cajero');
    await abrirCajaSiHaceFalta(sesion);
    await page.goto('/venta');

    // Por el nombre, sin tildes ni mayúsculas, y con Enter.
    await page.locator('#codigo-barras').fill(nombre.toUpperCase().replace('PAN DE', 'pan de'));
    const opcion = page.getByRole('option', { name: new RegExp(nombre) });
    await expect(opcion).toBeVisible();
    await page.locator('#codigo-barras').press('Enter');
    await expect(page.locator('tbody tr', { hasText: nombre })).toHaveCount(1);
    await expect(page.locator('#codigo-barras')).toHaveValue('');

    // Con un toque, en los que no tienen código.
    await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
    await expect(page.locator('tbody tr', { hasText: nombre })).toContainText('2');
  });

  test('el admin carga ahí mismo lo que buscó por nombre y no estaba', async ({ page }) => {
    const sesion = await entrarComo(page, 'admin');
    await abrirCajaSiHaceFalta(sesion);
    await page.goto('/venta');

    const nuevo = `Queso fresco ${Date.now() % 100000}`;
    await page.locator('#codigo-barras').fill(nuevo);
    await page.locator('#codigo-barras').press('Enter');
    await expect(page.getByText('Producto nuevo · sin código')).toBeVisible();
    await expect(page.locator('#np-nombre')).toHaveValue(nuevo);
    await page.locator('#np-precio').fill('2.50');
    await page.getByRole('button', { name: 'Crear y agregar a la venta' }).click();
    await expect(page.locator('tbody tr', { hasText: nuevo })).toHaveCount(1);
  });

  test('en Productos el código es opcional y se muestra "Sin código"', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/productos');
    await page.getByPlaceholder(/Buscar/).fill(nombre);
    await expect(page.getByText('Sin código').first()).toBeVisible();
  });
});
