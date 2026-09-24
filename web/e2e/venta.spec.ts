import { expect, test, type Page } from '@playwright/test';
import { API, consultar, entrarComo, monto, valorDeLaFranja, type Sesion } from './ayudas';

const COCA = '7861001234567';

interface Producto {
  codigoBarras: string;
  nombre: string;
  precioVentaCentavos: number;
}

async function precioDe(sesion: Sesion, codigo: string) {
  const productos = await consultar<Producto[]>('/productos', sesion);
  return productos.find((p) => p.codigoBarras === codigo)!;
}

async function cajaAbierta(sesion: Sesion): Promise<boolean> {
  return (await consultar<{ turno: unknown }>('/caja/actual', sesion)).turno !== null;
}

async function pedir(ruta: string, sesion: Sesion, body: object) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`);
}

async function escanear(page: Page, codigo: string) {
  await page.locator('#codigo-barras').fill(codigo);
  await page.locator('#codigo-barras').press('Enter');
}

test.describe('Vender (cajero)', () => {
  let sesion: Sesion;

  test.beforeEach(async ({ page }) => {
    sesion = await entrarComo(page, 'cajero');
    // Otra prueba (caja.spec) puede haberla cerrado.
    if (!(await cajaAbierta(sesion))) {
      await pedir('/caja/abrir', sesion, { fondoInicialCentavos: 2000 });
    }
  });

  test('cobra en efectivo: carrito, total, vuelto y confirmación con número de ticket', async ({
    page,
  }) => {
    const coca = await precioDe(sesion, COCA);
    await page.goto('/venta');
    await escanear(page, COCA);
    await expect(page.locator('tbody tr', { hasText: coca.nombre })).toHaveCount(1);
    await expect(valorDeLaFranja(page)).toHaveText(monto(coca.precioVentaCentavos));

    await page.getByRole('button', { name: `Agregar una unidad de ${coca.nombre}` }).click();
    await expect(valorDeLaFranja(page)).toHaveText(monto(coca.precioVentaCentavos * 2));

    await page.locator('#monto-recibido').fill('5');
    await page.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(page.getByText(/Venta registrada · ticket #\d+/)).toBeVisible();
    await expect(page.getByText(monto(500 - coca.precioVentaCentavos * 2))).toBeVisible();
    // El check termina de dibujarse.
    await expect(page.locator('.check-trazo')).toHaveCSS('stroke-dashoffset', '0px', {
      timeout: 3000,
    });
    await expect(page.getByRole('link', { name: 'Imprimir ticket' })).toHaveAttribute(
      'href',
      /\/ticket\/.+\?imprimir=1/,
    );
  });

  test('cobra por transferencia sin pedir monto recibido', async ({ page }) => {
    await page.goto('/venta');
    await escanear(page, COCA);
    await page.getByRole('radio', { name: 'Transferencia' }).click();
    await expect(page.locator('#monto-recibido')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cobrar por transferencia' }).click();
    await expect(page.getByText('Pagado por transferencia')).toBeVisible();
  });

  test('un código que no existe: el cajero no lo carga, se lo pide al administrador', async ({
    page,
  }) => {
    await page.goto('/venta');
    await escanear(page, '0000000000001');
    await expect(page.getByText(/no está en el catálogo\. Pedile al administrador/)).toBeVisible();
  });

  test('sin caja abierta pide abrirla antes de vender', async ({ page }) => {
    await pedir('/caja/cerrar', sesion, { efectivoContadoCentavos: 2000 });
    await page.goto('/venta');
    await expect(page.getByText('Tu caja está cerrada')).toBeVisible();
    await page.getByRole('button', { name: '$20,00' }).click();
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.locator('#codigo-barras')).toBeVisible();
  });
});
