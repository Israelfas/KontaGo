import { expect, test } from '@playwright/test';
import { CUENTAS } from './ayudas';

// Los emails de "olvidé mi contraseña" van a cuentas que no existen: si el
// backend tiene SMTP configurado, no sale ningún correo de verdad.
const NADIE = 'nadie-existe@kontago.test';

test.describe('Entrar', () => {
  test('con la cuenta demo entra al resumen', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(CUENTAS.admin.email);
    await page.locator('#password').fill(CUENTAS.admin.password);
    await page.getByRole('button', { name: 'Ingresar a KontaGo' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Resumen del día' })).toBeVisible();
  });

  test('contraseña equivocada: mensaje claro, igual exista o no la cuenta', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(NADIE);
    await page.locator('#password').fill('cualquiera1');
    await page.getByRole('button', { name: 'Ingresar a KontaGo' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Email o contraseña incorrectos.',
    );
    await expect(page.getByText('No pudimos cargar esta sección')).toHaveCount(0);
  });

  test('el ojo muestra y oculta la contraseña', async ({ page }) => {
    await page.goto('/login');
    const campo = page.locator('#password');
    await campo.fill('secreta');
    await expect(campo).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar la contraseña' }).click();
    await expect(campo).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar la contraseña' }).click();
    await expect(campo).toHaveAttribute('type', 'password');
  });

  test('un email mal escrito se avisa al salir del campo', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('maria@gmail');
    await page.locator('#password').focus();
    await expect(page.locator('#email-aviso')).toContainText('Revisá lo que va después de la @');
  });
});

test.describe('Recuperar la contraseña', () => {
  test('desde el login, con el email ya escrito; responde igual aunque no exista', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill(NADIE);
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/recuperar/);
    await expect(page.locator('#recuperar-email')).toHaveValue(NADIE);
    await page.getByRole('button', { name: 'Mandarme el enlace' }).click();
    await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reenviar en \d+ s/ })).toBeDisabled();
  });

  test('un enlace vencido o inventado lo dice de entrada, y no queda en la barra', async ({
    page,
  }) => {
    await page.goto(`/restablecer?token=${'x'.repeat(43)}`);
    await expect(page.getByRole('heading', { name: 'El enlace ya no sirve' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
  });
});

test.describe('Crear una cuenta', () => {
  test('pide 8 caracteres y aceptar los términos', async ({ page }) => {
    await page.goto('/registro');
    await page.locator('#nombre-tienda').fill('Tienda de prueba');
    await page.locator('#nombre-admin').fill('Ana');
    await page.locator('#registro-email').fill('ana-e2e@kontago.test');
    await page.locator('#registro-password').fill('corta');
    await page.locator('#registro-password').blur();
    await expect(page.locator('#registro-password-aviso')).toContainText('son 8 como mínimo');

    await page.locator('#registro-password').fill('una frase segura');
    await expect(page.getByText('Seguridad: Fuerte')).toBeVisible();
    await page.getByRole('button', { name: 'Crear mi tienda' }).click();
    await expect(page.locator('#registro-terminos-aviso')).toContainText('tenés que aceptarlos');
    await expect(page).toHaveURL(/\/registro/);
  });

  test('términos y privacidad son públicos', async ({ page }) => {
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '7. Tus derechos' })).toBeVisible();
    await page.goto('/terminos');
    await expect(page.getByRole('heading', { name: 'Términos y condiciones' })).toBeVisible();
  });
});
