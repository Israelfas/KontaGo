import { expect, test } from '@playwright/test';
import { API, consultar, entrarComo, esperarVentana, ventana, type Sesion } from './ayudas';

async function asegurarCajaAbierta(sesion: Sesion) {
  const { turno } = await consultar<{ turno: unknown }>('/caja/actual', sesion);
  if (turno) return;
  await fetch(`${API}/caja/abrir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify({ fondoInicialCentavos: 2000 }),
  });
}

test.describe('Caja', () => {
  test('el cajero no ve cuánto debería haber (conteo a ciegas)', async ({ page }) => {
    const sesion = await entrarComo(page, 'cajero');
    await asegurarCajaAbierta(sesion);
    await page.goto('/caja');
    await expect(page.getByText(/Abierta a las/i)).toBeVisible();
    await expect(page.getByText('Efectivo que debería haber')).toHaveCount(0);
  });

  test('sacar efectivo se registra en una ventana y queda en la lista', async ({ page }) => {
    const sesion = await entrarComo(page, 'cajero');
    await asegurarCajaAbierta(sesion);
    await page.goto('/caja');
    await page.getByRole('button', { name: 'Sacar o poner efectivo' }).click();
    await esperarVentana(page, 'Sacar o poner efectivo');
    await ventana(page).locator('#movimiento-monto').fill('2.50');
    await ventana(page).locator('#movimiento-motivo').fill('pa');
    await expect(ventana(page).locator('#movimiento-motivo-aviso')).toHaveText(
      'Escribe 1 letra más.',
    );
    await ventana(page).locator('#movimiento-motivo').fill('Compra de fundas');
    await ventana(page).getByRole('button', { name: 'Registrar' }).click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(page.getByText('Compra de fundas')).toBeVisible();
  });

  test('cerrar la caja: conteo en ventana, confirmación y resultado', async ({ page }) => {
    const sesion = await entrarComo(page, 'cajero');
    await asegurarCajaAbierta(sesion);
    await page.goto('/caja');
    await page.getByRole('button', { name: 'Cerrar la caja' }).click();
    await esperarVentana(page, 'Cerrar la caja');
    await ventana(page).getByRole('radio', { name: 'Escribir el total' }).click();
    await ventana(page).locator('#total-contado').fill('150');
    await expect(ventana(page).getByText('$150,00')).toBeVisible();
    await ventana(page).getByRole('button', { name: 'Cerrar caja' }).click();
    await expect(ventana(page).getByText('Después no se puede cambiar el conteo')).toBeVisible();
    await ventana(page).getByRole('button', { name: 'Sí, cerrar' }).click();
    await expect(page.getByRole('heading', { name: 'Resultado del cierre' })).toBeVisible();
    await expect(page.getByText(/(Faltan|Sobran) \$|Cuadra/).first()).toBeVisible();
  });

  test('el admin ve las cajas del equipo y abre el detalle en una ventana', async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: 'Cajas del equipo' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver el detalle' }).first().click();
    await esperarVentana(page, /^Caja de /);
    await page.keyboard.press('Escape');
    await expect(ventana(page)).toHaveCount(0);
  });
});
