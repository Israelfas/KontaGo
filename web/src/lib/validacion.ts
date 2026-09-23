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

export const LARGO_MINIMO_CONTRASENA = 8;

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

// Las mismas que rechaza el backend (common/seguridad/politica-password.ts).
const MAS_USADAS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  '12341234',
  '11223344',
  'password',
  'password1',
  'password123',
  'contraseña',
  'contrasena',
  'contrasena1',
  'qwerty123',
  'qwertyui',
  'asdfghjk',
  'iloveyou',
  'abcd1234',
  'abc12345',
  'admin123',
  'administrador',
  'kontago',
  'kontago1',
  'kontago123',
  'ecuador1',
  'ecuador123',
  'tienda123',
  'minimarket',
  'bienvenido',
]);

/**
 * Qué tiene de malo una contraseña NUEVA (misma política que el backend:
 * al menos 8, no de las más usadas, no el propio email).
 */
export function problemaDeLaContrasena(contrasena: string, email?: string): string | null {
  if (!contrasena) return null;
  const faltan = faltanALaContrasena(contrasena);
  if (faltan > 0)
    return `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}: son ${LARGO_MINIMO_CONTRASENA} como mínimo.`;
  const normalizada = contrasena.trim().toLowerCase();
  if (MAS_USADAS.has(normalizada) || /^(.)\1+$/.test(normalizada))
    return 'Esa contraseña es de las más usadas: elegí otra.';
  const e = email?.trim().toLowerCase();
  if (e && (normalizada === e || normalizada === e.split('@')[0]))
    return 'La contraseña no puede ser tu email.';
  return null;
}

/**
 * Qué tan buena es, para la barrita de la contraseña nueva: el largo es
 * lo que más pesa (una frase le gana a "K0nt4go!").
 */
export function fuerzaDeLaContrasena(contrasena: string): {
  nivel: 0 | 1 | 2 | 3;
  texto: string;
} {
  if (!contrasena) return { nivel: 0, texto: '' };
  if (problemaDeLaContrasena(contrasena)) return { nivel: 1, texto: 'Débil' };
  const variedad = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/, /\s/].filter((r) =>
    r.test(contrasena),
  ).length;
  if (contrasena.length >= 14 || (contrasena.length >= 11 && variedad >= 3))
    return { nivel: 3, texto: 'Fuerte' };
  return { nivel: 2, texto: 'Aceptable · más larga es mejor' };
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
