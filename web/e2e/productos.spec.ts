import { expect, test } from '@playwright/test';
import { entrarComo, esperarVentana, ventana } from './ayudas';

// Para editar se usa un producto que no interviene en otras pruebas.
const SAL = 'Sal Crisal 1 kg';

test.describe('Productos (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/productos');
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('tocar la fila abre la edición en una ventana; Esc la cierra sin mover la lista', async ({
    page,
  }) => {
    const fila = page.locator('tbody tr', { hasText: SAL });
    await fila.scrollIntoViewIfNeeded();
    const antes = await page.evaluate(() => window.scrollY);
    expect(antes).toBeGreaterThan(0);
    await fila.locator('td').first().click();
    await esperarVentana(page, SAL);
    await expect(ventana(page).getByText(/Código/i)).toBeVisible();
    await expect(ventana(page).getByText(/Costo/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ventana(page)).toHaveCount(0);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - antes)).toBeLessThan(2);
  });

  test('guardar un precio nuevo cierra la ventana y se ve en la fila', async ({ page }) => {
    await page
      .locator('tbody tr', { hasText: SAL })
      .getByRole('button', { name: 'Editar' })
      .click();
    await esperarVentana(page, SAL);
    await ventana(page).locator('input[id^="editar-precio-"]').fill('0.65');
    await ventana(page).getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(page.locator('tbody tr', { hasText: SAL })).toContainText('$0,65');
  });

  test('vender por debajo del costo se avisa mientras se escribe', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await esperarVentana(page, 'Nuevo producto');
    await ventana(page).locator('#producto-precio').fill('0.70');
    await ventana(page).locator('#producto-costo').fill('0.90');
    await expect(
      ventana(page).getByText(/Vendes por debajo del costo: pierdes \$0,20/),
    ).toBeVisible();
  });

  test('alta de un producto nuevo y baja con confirmación', async ({ page }) => {
    const codigo = `99${Date.now()}`.slice(0, 13);
    const nombre = `Producto e2e ${codigo.slice(-4)}`;
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await esperarVentana(page, 'Nuevo producto');
    await ventana(page).locator('#producto-codigo').fill(codigo);
    await ventana(page).locator('#producto-nombre').fill(nombre);
    await ventana(page).locator('#producto-precio').fill('2.50');
    await ventana(page).locator('#producto-costo').fill('1.20');
    await ventana(page).getByRole('button', { name: 'Guardar producto' }).click();
    await expect(ventana(page)).toHaveCount(0);
    const fila = page.locator('tbody tr', { hasText: nombre });
    await expect(fila).toContainText('$2,50');

    await fila.getByRole('button', { name: 'Editar' }).click();
    await esperarVentana(page, nombre);
    await ventana(page).getByRole('button', { name: 'Dar de baja' }).click();
    await expect(ventana(page).getByText(/dejará de aparecer en el catálogo/)).toBeVisible();
    await ventana(page).getByRole('button', { name: 'Sí, dar de baja' }).click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(page.locator('tbody tr', { hasText: nombre })).toHaveCount(0);
  });
});
