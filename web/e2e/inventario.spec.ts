import { expect, test } from '@playwright/test';
import { entrarComo, esperarVentana, valorDeLaFranja, ventana } from './ayudas';

test.describe('Inventario (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
  });

  test('los formularios no ocupan la pantalla: dos botones que abren ventanas', async ({
    page,
  }) => {
    await expect(page.locator('#abastecimiento-producto')).toHaveCount(0);
    await page.getByRole('button', { name: /Registrar merma/ }).click();
    await esperarVentana(page, 'Merma');
    await page.keyboard.press('Escape');
    await expect(ventana(page)).toHaveCount(0);
  });

  test('abastecer desde una alerta: producto elegido y el gastado del día sube', async ({
    page,
  }) => {
    const antes = (await valorDeLaFranja(page).textContent()) ?? '';
    await page.getByRole('button', { name: 'Abastecer' }).first().click();
    await esperarVentana(page, 'Abastecimiento');
    const elegido = ventana(page).locator('#abastecimiento-producto');
    await expect(elegido).not.toHaveValue('');
    await ventana(page).locator('#abastecimiento-cantidad').fill('6');
    await ventana(page).locator('#abastecimiento-costo').fill('0.50');
    await ventana(page).getByRole('button', { name: 'Registrar abastecimiento' }).click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(valorDeLaFranja(page)).not.toHaveText(antes);
  });

  test('una merma mayor al stock se avisa y no deja registrar', async ({ page }) => {
    await page.getByRole('button', { name: /Registrar merma/ }).click();
    const selector = ventana(page).locator('#merma-producto');
    const opcion = selector.locator('option', { hasText: 'Coca-Cola 500' });
    const texto = (await opcion.textContent()) ?? '';
    const stock = Number(/stock (\d+)/.exec(texto)?.[1]);
    await selector.selectOption({ label: texto.trim() });
    await ventana(page)
      .locator('#merma-cantidad')
      .fill(String(stock + 5));
    await expect(ventana(page).locator('#merma-cantidad-aviso')).toContainText(`Solo hay ${stock}`);
    await expect(ventana(page).getByRole('button', { name: 'Registrar merma' })).toBeDisabled();
  });

  test('corregir lotes: ventana con las fechas y aviso si no suman el stock', async ({ page }) => {
    await page.getByRole('button', { name: 'Corregir' }).first().click();
    await esperarVentana(page, /^Lotes de /);
    const unidades = ventana(page).locator('input[type=number]').first();
    const actual = Number(await unidades.inputValue());
    await unidades.fill(String(actual + 1));
    await expect(ventana(page).getByText(/sobran 1/)).toBeVisible();
    await expect(ventana(page).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  test('dar de baja lo vencido pide confirmación en una ventana', async ({ page }) => {
    await page.getByRole('button', { name: 'Dar de baja' }).first().click();
    await esperarVentana(page, 'Dar de baja lo vencido');
    await expect(ventana(page).getByRole('button', { name: /Sí, dar de baja/ })).toBeVisible();
  });
});
