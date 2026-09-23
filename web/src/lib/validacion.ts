import { formatearCentavos } from './formato';
import { hoyISO } from './periodo';

/**
 * Las reglas de los DTO del backend (class-validator), para avisar
 * mientras se escribe y no recién al enviar. Copia en
 * mobile/src/lib/validacion.ts.
 *
 * Todas devuelven qué está mal, o null si está bien. Un campo vacío es
 * null: de lo obligatorio se encarga el formulario (botón deshabilitado o
 * `required`), no un cartel rojo antes de empezar a escribir.
 */

export const LARGO_MINIMO_CONTRASENA = 6;

// No es IsEmail entero (eso lo sigue revisando el backend): son los
// errores de tipeo que de verdad pasan.
export function problemaDelEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return null;
  if (/\s/.test(e)) return 'El email no lleva espacios.';
  const partes = e.split('@');
  if (partes.length === 1) return 'Le falta la @.';
  if (partes.length > 2) return 'Tiene más de una @.';
  const [usuario, dominio] = partes;
  if (!usuario) return 'Falta lo que va antes de la @.';
  if (!/^[^.]+(\.[^.]+)*\.[a-z]{2,}$/i.test(dominio))
    return `Revisá lo que va después de la @ (ej. ${usuario}@gmail.com).`;
  return null;
}

/** Cuántos caracteres le faltan a la contraseña (0 si ya alcanza). */
export function faltanALaContrasena(contrasena: string): number {
  return Math.max(0, LARGO_MINIMO_CONTRASENA - contrasena.length);
}

export function problemaDeLaContrasena(contrasena: string): string | null {
  const faltan = faltanALaContrasena(contrasena);
  if (!contrasena || faltan === 0) return null;
  return `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}: son ${LARGO_MINIMO_CONTRASENA} como mínimo.`;
}

/**
 * Lo que se muestra mientras se escribe la contraseña: no es un error,
 * es cuánto falta (en rojo va problemaDeLaContrasena, al salir del campo).
 */
export function ayudaDeLaContrasena(contrasena: string): string | null {
  if (!contrasena) return null;
  const faltan = faltanALaContrasena(contrasena);
  return faltan > 0 ? `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}.` : 'Largo suficiente.';
}

/** Nombres de tienda y de persona (MinLength(2) en el backend). */
export function problemaDelNombre(nombre: string, minimo = 2): string | null {
  const n = nombre.trim();
  if (!n || n.length >= minimo) return null;
  return `Muy corto: al menos ${minimo} letras.`;
}

/** Texto libre obligatorio con un largo mínimo (ej. el motivo de un retiro). */
export function problemaDelLargo(texto: string, minimo: number): string | null {
  const faltan = minimo - texto.trim().length;
  if (!texto || faltan <= 0) return null;
  return `Escribí ${faltan} letra${faltan === 1 ? '' : 's'} más.`;
}

/**
 * Advertencia, no error: vender bajo el costo puede ser a propósito (una
 * oferta), pero casi siempre es un precio mal tipeado.
 */
export function avisoDelMargen(
  precioCentavos: number | null,
  costoCentavos: number | null,
): string | null {
  if (precioCentavos === null || costoCentavos === null || costoCentavos <= 0) return null;
  if (precioCentavos < costoCentavos)
    return `Vendés por debajo del costo: perdés ${formatearCentavos(costoCentavos - precioCentavos)} en cada una.`;
  if (precioCentavos === costoCentavos) return 'Es el mismo precio que el costo: no le ganás nada.';
  return null;
}

/** Fecha de vencimiento 'AAAA-MM-DD' ya pasada (advertencia). */
export function avisoDelVencimiento(fecha: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const hoy = hoyISO();
  if (fecha < hoy) return 'Esa fecha ya pasó: entraría vencido.';
  if (fecha === hoy) return 'Vence hoy.';
  return null;
}

/** "1.50" o "1,50" → 150. null si está vacío o no es un monto. */
export function aCentavos(texto: string): number | null {
  if (!texto.trim()) return null;
  const valor = Math.round(parseFloat(texto.replace(',', '.')) * 100);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}
