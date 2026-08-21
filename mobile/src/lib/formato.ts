/**
 * Convierte centavos (enteros, como los guarda el backend — ver sección 6.3
 * del spec) a un string de moneda legible. Nunca se hacen cuentas con estos
 * strings, solo se muestran; toda la aritmética real pasa por el backend
 * en centavos.
 */
export function formatearCentavos(centavos: number, moneda = 'USD'): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'narrowSymbol',
  }).format(centavos / 100);
}
