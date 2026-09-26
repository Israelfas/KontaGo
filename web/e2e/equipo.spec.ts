import { expect, test, type Page } from '@playwright/test';
import { API, entrarComo, esperarVentana, ventana } from './ayudas';

const CLAVE = 'una frase segura';

async function login(email: string, password: string) {
  return fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36',
    },
    body: JSON.stringify({ email, password }),
  });
}

/** Da de alta a alguien desde la pantalla y devuelve su email. */
async function agregarPersona(page: Page, nombre: string) {
  const email = `${nombre.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@kontago.test`;
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await esperarVentana(page, 'Agregar persona');
  await ventana(page).locator('#persona-nombre').fill(nombre);
  await ventana(page).locator('#persona-email').fill(email);
  await ventana(page).locator('#persona-password').fill(CLAVE);
  await ventana(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(ventana(page)).toHaveCount(0);
  return email;
}

// Por email: sin seed, las corridas anteriores dejan personas con el mismo nombre.
const filaDe = (page: Page, email: string) => page.locator(`[data-persona="${email}"]`);

test.describe('Equipo y actividad de seguridad (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'admin');
    await page.goto('/equipo');
    await expect(page.locator('[data-persona]').first()).toBeVisible();
  });

  test('agregar a alguien: ventana, política de contraseña y aparece sin ingresos', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Agregar persona' }).click();
    await ventana(page).locator('#persona-password').fill('abcd');
    await expect(ventana(page).locator('#persona-password-aviso')).toHaveText(
      'Faltan 4 caracteres.',
    );
    await page.keyboard.press('Escape');
    const email = await agregarPersona(page, 'Lucía Nueva');
    await expect(filaDe(page, email)).toContainText('Nunca');
  });

  test('la actividad muestra dónde tiene la sesión abierta y qué pasó', async ({ page }) => {
    const email = await agregarPersona(page, 'Tomás Actividad');
    expect((await login(email, CLAVE)).ok).toBe(true);
    await page.reload();
    await filaDe(page, email).getByRole('button', { name: 'Actividad' }).click();
    await esperarVentana(page, 'Actividad de Tomás Actividad');
    await expect(ventana(page).getByText('Chrome en Windows').first()).toBeVisible();
    await expect(ventana(page).getByText('Entró', { exact: true })).toBeVisible();
  });

  test('en la actividad propia, "Este dispositivo"', async ({ page }) => {
    await page
      .locator('[data-persona]', { hasText: '(tú)' })
      .getByRole('button', { name: 'Actividad' })
      .click();
    await esperarVentana(page, 'Tu actividad');
    await expect(ventana(page).getByText('Este dispositivo')).toBeVisible();
  });

  test('una cuenta bloqueada por intentos fallidos se ve y se desbloquea', async ({ page }) => {
    const email = await agregarPersona(page, 'Rita Bloqueo');
    for (let i = 0; i < 5; i++) await login(email, `mala-${i}-clave`);
    await page.reload();
    const fila = filaDe(page, email);
    await expect(fila.getByText('Bloqueada')).toBeVisible();
    await fila.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByText('Rita Bloqueo ya puede volver a entrar.')).toBeVisible();
    await expect(fila.getByText('Bloqueada')).toHaveCount(0);
    expect((await login(email, CLAVE)).ok).toBe(true);
  });

  test('cerrar las sesiones de alguien: con confirmación, y su acceso deja de servir', async ({
    page,
  }) => {
    const email = await agregarPersona(page, 'Hugo Sesiones');
    const { accessToken } = (await (await login(email, CLAVE)).json()) as { accessToken: string };
    await page.reload();
    await filaDe(page, email).getByRole('button', { name: 'Actividad' }).click();
    await esperarVentana(page, 'Actividad de Hugo Sesiones');
    await ventana(page)
      .getByRole('button', { name: 'Cerrar sesión en todos sus dispositivos' })
      .click();
    await expect(ventana(page).getByText('va a tener que volver a entrar')).toBeVisible();
    await ventana(page).getByRole('button', { name: 'Sí, cerrar todas' }).click();
    await expect(ventana(page)).toHaveCount(0);
    const perfil = await fetch(`${API}/auth/perfil`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(perfil.status).toBe(401);
  });
});
