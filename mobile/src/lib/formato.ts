// Formato de Ecuador: "$4,71", "$1.234,50". Con 'es' a secas el símbolo
// quedaba al final ("4,71 $"), como en España.
const LOCALE = 'es-EC';

const formateadores = new Map<string, Intl.NumberFormat>();

/**
 * Convierte centavos (enteros, como los guarda el backend — ver sección 6.3
 * del spec) a un string de moneda legible. Nunca se hacen cuentas con estos
 * strings, solo se muestran; toda la aritmética real pasa por el backend
 * en centavos.
 */
export function formatearCentavos(centavos: number, moneda = 'USD'): string {
  let formateador = formateadores.get(moneda);
  if (!formateador) {
    formateador = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: moneda,
      currencyDisplay: 'narrowSymbol',
    });
    formateadores.set(moneda, formateador);
  }
  return formateador.format(centavos / 100);
}

/**
 * 'AAAA-MM-DD' (fecha de calendario, como fechaVencimiento) → "25 sept",
 * o "10 abr 2027" si no es de este año: sin el año, una fecha del año que
 * viene se confunde con una de este.
 */
export function formatearFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // Se arma en hora local (no new Date('AAAA-MM-DD'), que es medianoche
  // UTC y en Ecuador cae el día anterior).
  const d = new Date(anio, mes - 1, dia);
  return d.toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(anio !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * Lo que se va tipeando en un campo de fecha → 'AAAA-MM-DD'. El teclado
 * numérico del iPhone no tiene guion: los pone solo (20261005 →
 * 2026-10-05). También acepta lo que se pegue con guiones.
 */
export function escribirFecha(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 4) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6)}`;
}

/** 'AAAA-MM-DD' de una fecha que existe (no 2026-02-30). */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia);
  return d.getFullYear() === anio && d.getMonth() === mes - 1 && d.getDate() === dia;
}
