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
