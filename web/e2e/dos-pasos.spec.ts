import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { API, ponerCookieDeSesion } from './ayudas';

const CLAVE = 'una frase segura';

/** El código que mostraría la app autenticadora (TOTP, RFC 6238). */
function codigoDeLaApp(secretoBase32: string, corrimiento = 0): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const letra of secretoBase32.replace(/\s/g, '')) {
    bits += alfabeto.indexOf(letra).toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + corrimiento));
  const h = createHmac('sha1', bytes).update(contador).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Una tienda nueva (no se toca la de la demo). */
async function cuentaNueva() {
  const email = `dos-pasos-${Date.now()}@kontago.test`;
  const r = await fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombreTienda: 'Bodega Segura',
      nombreAdmin: 'Elena Segura',
      email,
      password: CLAVE,
      aceptaTerminos: true,
    }),
  });
  expect(r.ok).toBe(true);
  return { email, ...((await r.json()) as { accessToken: string; refreshToken: string }) };
}

async function entrarConTokens(page: Page, tokens: { accessToken: string; refreshToken: string }) {
  await ponerCookieDeSesion(page.context(), tokens.refreshToken);
}

async function salir(page: Page) {
  await page.context().clearCookies();
}

async function ponerContrasena(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar a KontaGo' }).click();
  await expect(page.getByRole('heading', { name: 'Un paso más' })).toBeVisible();
}

test('activar la verificación en dos pasos y entrar con el código', async ({ page }) => {
  const cuenta = await cuentaNueva();
  await entrarConTokens(page, cuenta);
  await page.goto('/productos');

  // Activar desde el menú de la cuenta.
  await page.getByRole('button', { name: /Tu cuenta/ }).click();
  await page.getByRole('button', { name: 'Verificación en dos pasos' }).click();
  const ventana = page.locator('dialog.ventana[open]');
  await ventana.getByRole('button', { name: 'Activar' }).click();
  await expect(ventana.getByRole('img', { name: /Código QR/ })).toBeVisible();
  const secreto = (await ventana.locator('.select-all').textContent())!.trim();

  await ventana.locator('#codigo-activar').fill('000000');
  await ventana.getByRole('button', { name: 'Activar' }).click();
  await expect(ventana.getByRole('alert')).toContainText('no es correcto');

  await ventana.locator('#codigo-activar').fill(codigoDeLaApp(secreto));
  await ventana.getByRole('button', { name: 'Activar' }).click();
  await expect(ventana.getByText('No se vuelven a mostrar')).toBeVisible();
  const codigos = await ventana.locator('ul li').allTextContents();
  expect(codigos).toHaveLength(8);
  await ventana.getByRole('button', { name: 'Ya los guardé' }).click();
  await expect(ventana).toHaveCount(0);

  // Salir y volver: con la contraseña sola no alcanza.
  await salir(page);
  await ponerContrasena(page, cuenta.email);
  // El de la activación ya se usó: la app ya muestra el siguiente.
  await page.locator('#codigo-dos-pasos').fill(codigoDeLaApp(secreto, 1));
  await expect(page).toHaveURL(/\/dashboard/);

  // Sin el celular: un código de recuperación.
  await salir(page);
  await ponerContrasena(page, cuenta.email);
  await page.getByRole('button', { name: 'No tengo el celular' }).click();
  await page.locator('#codigo-dos-pasos').fill(codigos[0]);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // El mismo código de recuperación no sirve dos veces.
  await salir(page);
  await ponerContrasena(page, cuenta.email);
  await page.getByRole('button', { name: 'No tengo el celular' }).click();
  await page.locator('#codigo-dos-pasos').fill(codigos[0]);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('no es correcto');
});
