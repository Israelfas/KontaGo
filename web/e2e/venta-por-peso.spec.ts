import { expect, test } from '@playwright/test';
import { API, consultar, entrarComo, monto, tokensDe, type Sesion } from './ayudas';

/*
 * Lo que va por peso (arroz, queso): en la caja se pregunta cuánto, con
 * un toque (media libra), el peso exacto o por cuánto dinero.
 */

interface Producto {
  id: string;
  nombre: string;
  stock: number;
}

async function pedir(ruta: string, sesion: Sesion, body: object) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<Producto>;
}

async function abrirCajaSiHaceFalta(sesion: Sesion) {
  const { turno } = await consultar<{ turno: unknown }>('/caja/actual', sesion);
  if (!turno) await pedir('/caja/abrir', sesion, { fondoInicialCentavos: 2000 });
}

test.describe('Venta por peso', () => {
  const nombre = `Queso de hoja ${Date.now() % 100000}`;
  let queso: Producto;

  test.beforeAll(async () => {
    queso = await pedir('/productos', await tokensDe('admin'), {
      nombre,
      unidad: 'libra',
      precioVentaCentavos: 325,
      stockInicial: 10,
    });
  });

  test('media libra con un toque, y después por dinero', async ({ page }) => {
    const sesion = await entrarComo(page, 'cajero');
    await abrirCajaSiHaceFalta(sesion);
    await page.goto('/venta');

    await page.locator('#codigo-barras').fill(nombre);
    await page.locator('#codigo-barras').press('Enter');
    const ventana = page.locator('dialog.ventana[open]');
    await expect(ventana.getByRole('heading', { name: `¿Cuánto de ${nombre}?` })).toBeVisible();
    // $3,25 × 0,5 = $1,625 → $1,63.
    await ventana.getByRole('button', { name: /0,5 lb/ }).click();
    const fila = page.locator('tbody tr', { hasText: nombre });
    await expect(fila).toContainText('0,5 lb');
    await expect(fila).toContainText(monto(163));

    // Cambiar: "un dólar de queso".
    await fila.getByRole('button', { name: `Cambiar cuánto de ${nombre}` }).click();
    await ventana.locator('#peso-dinero').fill('1');
    await expect(ventana.locator('#peso-cantidad')).toHaveValue('0.308');
    await ventana.getByRole('button', { name: 'Cambiar' }).click();
    await expect(fila).toContainText('0,308 lb');
    await expect(fila).toContainText(monto(100));

    await page.getByRole('radio', { name: 'Transferencia' }).click();
    await page.getByRole('button', { name: 'Cobrar por transferencia' }).click();
    await expect(page.getByText(/Venta registrada · ticket/)).toBeVisible();

    const productos = await consultar<Producto[]>('/productos', sesion);
    expect(productos.find((p) => p.id === queso.id)!.stock).toBe(9.692);
  });

  test('en Productos se elige "Por libra" y el stock va con decimales', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/productos');
    await page.getByRole('button', { name: /Nuevo producto/ }).click();
    const ventana = page.locator('dialog.ventana[open]');
    const arroz = `Arroz suelto ${Date.now() % 100000}`;
    await ventana.locator('#producto-nombre').fill(arroz);
    await ventana.getByRole('radio', { name: 'Por libra' }).click();
    await expect(ventana.getByText('Precio de venta por libra')).toBeVisible();
    await ventana.locator('#producto-precio').fill('0.60');
    await ventana.locator('#producto-stock').fill('25.5');
    await ventana.getByRole('button', { name: 'Guardar producto' }).click();
    await expect(ventana).toHaveCount(0);

    await page.getByPlaceholder(/Buscar/).fill(arroz);
    await expect(page.getByText('25,5 lb').first()).toBeVisible();
    await expect(page.getByText('/ lb').first()).toBeVisible();
  });
});
