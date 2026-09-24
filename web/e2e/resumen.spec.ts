import { expect, test } from '@playwright/test';
import { consultar, entrarComo, monto, valorDeLaFranja } from './ayudas';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
const haceDias = (n: number) =>
  new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });

interface Resumen {
  gananciaCentavos: number;
  ingresoBrutoCentavos: number;
}

test.describe('Resumen y ventas (admin)', () => {
  test('la ganancia del día coincide con la del backend', async ({ page }) => {
    const sesion = await entrarComo(page, 'admin');
    const r = await consultar<Resumen>(`/ventas/resumen?desde=${hoy()}&hasta=${hoy()}`, sesion);
    await page.goto('/dashboard');
    await expect(valorDeLaFranja(page)).toHaveText(monto(r.gananciaCentavos));
    await expect(page.locator('.barra-columna').first()).toBeVisible();
  });

  test('cambiar a 7 días: URL, título y montos del período', async ({ page }) => {
    const sesion = await entrarComo(page, 'admin');
    const r = await consultar<Resumen>(
      `/ventas/resumen?desde=${haceDias(6)}&hasta=${hoy()}`,
      sesion,
    );
    await page.goto('/dashboard');
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page).toHaveURL(new RegExp(`desde=${haceDias(6)}&hasta=${hoy()}`));
    await expect(page.getByRole('heading', { name: 'Últimos 7 días' })).toBeVisible();
    await expect(valorDeLaFranja(page)).toHaveText(monto(r.gananciaCentavos));
  });

  test('un rango de más de 92 días se avisa antes de tocar Ver', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/ventas');
    await page.getByRole('button', { name: 'Elegir fechas' }).click();
    const [desde, hasta] = await page.locator('.periodo-rango input[type=date]').all();
    await desde.fill(haceDias(120));
    await hasta.fill(hoy());
    await expect(page.getByRole('button', { name: 'Ver', exact: true })).toBeDisabled();
    await expect(page.locator('.periodo-error')).toContainText('92');
  });

  test('ventas del día con número de ticket, y el ticket lleva los datos de la tienda', async ({
    page,
  }) => {
    await entrarComo(page, 'admin');
    await page.goto('/ventas');
    const enlace = page.getByRole('link', { name: 'Imprimir ticket' }).first();
    await expect(enlace).toBeVisible();
    const href = (await enlace.getAttribute('href')) ?? '';
    await page.goto(href.replace('?imprimir=1', ''));
    await expect(page.getByText(/Ticket #\d+/)).toBeVisible();
    await expect(page.getByText(/RUC \d{13}/)).toBeVisible();
    await expect(page.getByText(/no reemplaza a la factura/)).toBeVisible();
  });

  test('el menú marca la sección y la pastilla llega hasta ella', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/dashboard');
    await page.locator('header nav').getByRole('link', { name: 'Productos' }).click();
    await expect(page).toHaveURL(/\/productos/);
    const activo = page.locator('header nav [aria-current="page"]');
    await expect(activo).toHaveText(/Productos/);
    // La pastilla termina exactamente sobre la sección elegida.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const p = document.querySelector('.nav-indicador') as HTMLElement | null;
          const a = document.querySelector(
            'header nav [aria-current="page"]',
          ) as HTMLElement | null;
          if (!p || !a) return 999;
          return Math.abs(new DOMMatrixReadOnly(getComputedStyle(p).transform).m41 - a.offsetLeft);
        }),
      )
      .toBeLessThan(1);
  });
});

test.describe('Permisos del cajero', () => {
  test('no ve Resumen, Inventario ni Equipo', async ({ page }) => {
    await entrarComo(page, 'cajero');
    await page.goto('/venta');
    const menu = page.locator('header nav');
    await expect(menu.getByRole('link', { name: 'Vender' })).toBeVisible();
    for (const seccion of ['Resumen', 'Inventario', 'Equipo']) {
      await expect(menu.getByRole('link', { name: seccion })).toHaveCount(0);
    }
    await page.goto('/inventario');
    await expect(page).not.toHaveURL(/\/inventario/);
  });
});
