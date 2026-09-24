import { expect, test } from '@playwright/test';
import { entrarComo, esperarVentana, ventana } from './ayudas';

// Corre con el proyecto "celular" (Pixel 7): pantalla chica y táctil.

const sinScrollLateral = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('login y registro entran en la pantalla', async ({ page }) => {
  await page.goto('/login');
  expect(await sinScrollLateral(page)).toBe(true);
  await page.goto('/registro');
  expect(await sinScrollLateral(page)).toBe(true);
});

test('la landing entra en la pantalla, de arriba a abajo', async ({ page }) => {
  await page.goto('/');
  for (const id of ['producto', 'como-funciona', 'descargar', 'preguntas']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    expect(await sinScrollLateral(page)).toBe(true);
  }
});

test('barra de secciones abajo, y la rayita sobre la sección actual', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/dashboard');
  const barra = page.getByRole('navigation', { name: 'Secciones' });
  await expect(barra.getByRole('link', { name: 'Resumen' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await sinScrollLateral(page)).toBe(true);
});

test('las ventanas son hojas pegadas abajo', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/inventario');
  await page.getByRole('button', { name: /Registrar abastecimiento/ }).click();
  await esperarVentana(page, 'Abastecimiento');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = document
          .querySelector('dialog.ventana[open] .ventana-panel')!
          .getBoundingClientRect();
        return Math.round(window.innerHeight - r.bottom);
      }),
    )
    .toBe(0);
  await expect(ventana(page).locator('.ventana-pie')).toHaveCSS('position', 'sticky');
});

test('vender desde el celular: el carrito en tarjetas', async ({ page }) => {
  await entrarComo(page, 'cajero');
  await page.goto('/venta');
  // Si otra prueba cerró la caja, se abre acá mismo.
  const cerrada = page.getByText('Tu caja está cerrada');
  if (await cerrada.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '$20,00' }).click();
    await page.getByRole('button', { name: 'Abrir caja' }).click();
  }
  await page.locator('#codigo-barras').fill('7861001234567');
  await page.locator('#codigo-barras').press('Enter');
  await expect(page.locator('li.entra', { hasText: 'Coca-Cola 500 ml' })).toBeVisible();
  expect(await sinScrollLateral(page)).toBe(true);
});
