import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ayudas';

const carrusel = (page: Page) => page.getByRole('region', { name: 'Recorrido por KontaGo' });
const pestanaActiva = (page: Page) => carrusel(page).getByRole('tab', { selected: true });

/** Hasta que React conecta el carrusel, arrastrar no hace nada: la pastilla
 *  de las pestañas recibe su ancho recién al montarse. */
async function abrirElCarrusel(page: Page) {
  await page.goto('/#producto');
  await expect(carrusel(page).locator('.carrusel-indicador')).toHaveAttribute('style', /width/);
}

/**
 * Arrastra la diapositiva activa en horizontal durante `ms`, con un cuadro
 * cada ~16 ms como una mano de verdad: la velocidad al soltar decide.
 *
 * El gesto se arma dentro de la página: con page.mouse cada movimiento
 * viaja por el proceso de pruebas y llegan espaciados de a 70 ms o más,
 * así un tirón rápido nunca sería rápido.
 */
async function arrastrar(page: Page, dx: number, ms: number) {
  await page.evaluate(
    async ({ dx, ms }) => {
      const destino = document.querySelector('[data-activa="true"]')!;
      const caja = destino.getBoundingClientRect();
      const x = caja.x + caja.width / 2;
      const y = caja.y + caja.height / 2;
      const puntero = (tipo: string, clientX: number) =>
        destino.dispatchEvent(
          new PointerEvent(tipo, {
            bubbles: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            clientX,
            clientY: y,
          }),
        );
      const pasos = Math.max(2, Math.round(ms / 16));
      puntero('pointerdown', x);
      for (let i = 1; i <= pasos; i++) {
        await new Promise((r) => setTimeout(r, ms / pasos));
        puntero('pointermove', x + (dx * i) / pasos);
      }
      puntero('pointerup', x + dx);
    },
    { dx, ms },
  );
  // Que termine de acomodarse antes del próximo gesto.
  await page.waitForTimeout(700);
}

test.describe('Landing', () => {
  test('presenta el producto y lleva a crear la cuenta', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/KontaGo/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'La caja de tu tienda, en el celular.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Crear mi tienda gratis' }).first().click();
    await expect(page).toHaveURL(/\/registro/);
  });

  test('sin sesión ofrece entrar; con sesión, volver a la tienda', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toBeVisible();
    await entrarComo(page, 'admin');
    await page.goto('/');
    const volver = page.getByRole('banner').getByRole('link', { name: 'Ir a mi tienda' });
    await expect(volver).toBeVisible();
    await volver.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('carrusel: pestañas, flechas y teclado', async ({ page }) => {
    await abrirElCarrusel(page);
    await expect(pestanaActiva(page)).toHaveText('Vender');
    await carrusel(page).getByRole('tab', { name: 'Resumen' }).click();
    await expect(pestanaActiva(page)).toHaveText('Resumen');
    await expect(carrusel(page).locator('[data-activa="true"]')).toContainText('Tu ganancia real');
    await carrusel(page).getByRole('button', { name: 'Siguiente' }).click();
    await expect(pestanaActiva(page)).toHaveText('Equipo');
    // Al final la flecha queda inactiva pero con el foco: el teclado sigue andando.
    await expect(carrusel(page).getByRole('button', { name: 'Siguiente' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(pestanaActiva(page)).toHaveText('Resumen');
  });

  test('carrusel: se arrastra, y un tirón corto pero rápido también pasa', async ({ page }) => {
    await abrirElCarrusel(page);
    await expect(pestanaActiva(page)).toHaveText('Vender');
    // Arrastre largo y lento hacia la izquierda: pasa a la siguiente.
    await arrastrar(page, -500, 700);
    await expect(pestanaActiva(page)).toHaveText('Caja');
    // Tirón corto (menos de un cuarto) pero rápido: el impulso la pasa igual.
    await arrastrar(page, -140, 60);
    await expect(pestanaActiva(page)).toHaveText('Inventario');
    // Movimiento chiquito y lento: vuelve a la misma.
    await arrastrar(page, 40, 800);
    await expect(pestanaActiva(page)).toHaveText('Inventario');
    // En el primero, tirar hacia la derecha no pasa de largo.
    await carrusel(page).getByRole('tab', { name: 'Vender' }).click();
    // Se deja llegar: si se lo agarra en el camino, sigue desde donde iba.
    await page.waitForTimeout(900);
    await arrastrar(page, 400, 300);
    await expect(pestanaActiva(page)).toHaveText('Vender');
  });

  test('descarga: sin enlaces configurados, "Muy pronto" y el registro', async ({ page }) => {
    await page.goto('/#descargar');
    const seccion = page.locator('#descargar');
    await expect(seccion.getByText(/para\s*Android/)).toBeVisible();
    await expect(seccion.getByRole('link', { name: 'crear mi cuenta' })).toBeVisible();
  });

  test('preguntas: se abren y dicen la verdad sobre el SRI', async ({ page }) => {
    await page.goto('/#preguntas');
    await page.getByText('¿Emite facturas electrónicas del SRI?').click();
    await expect(page.getByText(/no reemplaza a la factura/)).toBeVisible();
  });
});
