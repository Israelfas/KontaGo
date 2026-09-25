import { expect, test } from '@playwright/test';
import { API, CUENTAS } from './ayudas';

/**
 * La sesión de la web vive en una cookie httpOnly: los scripts de la página
 * no la ven (ni uno malicioso), y en el almacenamiento del navegador no
 * queda ningún token.
 */
test.describe('Sesión segura de la web', () => {
  test('al entrar, la sesión queda en una cookie que ningún script puede leer', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill(CUENTAS.admin.email);
    await page.locator('#password').fill(CUENTAS.admin.password);
    await page.getByRole('button', { name: 'Ingresar a KontaGo' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const cookie = (await context.cookies()).find((c) => c.name === 'kontago_sesion');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');

    const visto = await page.evaluate(() => ({
      cookies: document.cookie,
      guardado: Object.keys(localStorage).filter((k) => k.startsWith('kontago.')),
    }));
    expect(visto.cookies).not.toContain('kontago_sesion');
    expect(visto.guardado).toEqual([]);

    // Recargar no saca a nadie: la sesión se renueva con la cookie.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('button', { name: /Tu cuenta/ })).toBeVisible();
  });

  test('una sesión de antes (en el navegador) pasa sola a la cookie', async ({ page, context }) => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CUENTAS.cajero.email, password: CUENTAS.cajero.password }),
    });
    const { accessToken, refreshToken } = (await r.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    await page.goto('/login');
    await page.evaluate(
      ({ accessToken, refreshToken }) => {
        localStorage.setItem('kontago.accessToken', accessToken);
        localStorage.setItem('kontago.refreshToken', refreshToken);
      },
      { accessToken, refreshToken },
    );

    await page.goto('/venta');
    await expect(page).toHaveURL(/\/venta/);
    await expect(page.getByRole('button', { name: /Tu cuenta/ })).toBeVisible();
    // Canjeada: ya no queda en el navegador, y está la cookie.
    const guardado = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('kontago.')),
    );
    expect(guardado).toEqual([]);
    expect((await context.cookies()).some((c) => c.name === 'kontago_sesion')).toBe(true);
  });

  test('salir corta la sesión de verdad', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email').fill(CUENTAS.admin.email);
    await page.locator('#password').fill(CUENTAS.admin.password);
    await page.getByRole('button', { name: 'Ingresar a KontaGo' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    const cookie = (await context.cookies()).find((c) => c.name === 'kontago_sesion')!;

    await page.getByRole('button', { name: /Tu cuenta/ }).click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/);

    // El navegador ya no la tiene, y en el servidor dejó de servir.
    await expect
      .poll(async () => (await context.cookies()).some((c) => c.name === 'kontago_sesion'))
      .toBe(false);
    const renovar = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: cookie.value }),
    });
    expect(renovar.status).toBe(401);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
