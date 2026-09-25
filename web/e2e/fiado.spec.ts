import { expect, test } from '@playwright/test';
import { API, consultar, entrarComo, monto, type Sesion } from './ayudas';

/*
 * Fiado: se vende a un cliente de confianza sin cobrar, queda en su cuenta
 * y después paga (todo o una parte).
 */

const COCA = '7861001234567';

async function pedir(ruta: string, sesion: Sesion, body: object) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function abrirCajaSiHaceFalta(sesion: Sesion) {
  const { turno } = await consultar<{ turno: unknown }>('/caja/actual', sesion);
  if (!turno) await pedir('/caja/abrir', sesion, { fondoInicialCentavos: 2000 });
}

test('fiar desde la caja, verlo en Fiados y registrar un abono', async ({ page }) => {
  const sesion = await entrarComo(page, 'cajero');
  await abrirCajaSiHaceFalta(sesion);
  const coca = (
    await consultar<{ codigoBarras: string; precioVentaCentavos: number }[]>('/productos', sesion)
  ).find((p) => p.codigoBarras === COCA)!;
  const nombre = `Vecina ${Date.now() % 100000}`;

  // Vender al fiado a alguien nuevo, anotado ahí mismo.
  await page.goto('/venta');
  await page.locator('#codigo-barras').fill(COCA);
  await page.locator('#codigo-barras').press('Enter');
  await page.getByRole('button', { name: 'Agregar una unidad de', exact: false }).first().click();
  await page.getByRole('radio', { name: 'Fiado' }).click();
  await page.locator('#cliente-fiado').fill(nombre);
  await page.getByRole('button', { name: new RegExp(`Anotar a “${nombre}”`) }).click();
  await expect(page.getByText('al día')).toBeVisible();
  await page.getByRole('button', { name: 'Anotar al fiado' }).click();
  await expect(page.getByText(`Anotado al fiado de ${nombre}`)).toBeVisible();

  // En Fiados aparece con lo que debe.
  const deuda = coca.precioVentaCentavos * 2;
  await page.goto('/fiados');
  const fila = page.getByRole('button', { name: new RegExp(nombre) });
  await expect(fila).toContainText(`debe ${monto(deuda)}`);

  // Paga una parte en efectivo.
  await fila.click();
  const ventana = page.locator('dialog.ventana[open]');
  await expect(ventana.getByText('Ticket #')).toBeVisible();
  await ventana.locator('#abono-monto').fill('1');
  await ventana.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(ventana.getByText('Abono registrado.')).toBeVisible();
  await expect(ventana.getByText('Abono en efectivo')).toBeVisible();
  await expect(ventana.getByText(monto(deuda - 100)).first()).toBeVisible();
});
