import { randomInt } from 'node:crypto';

/*
 * Código para los productos que no traen código de barras (pan, huevos,
 * caramelos sueltos, lo que se vende a granel).
 *
 * Es un EAN-13 con prefijo 20: los prefijos 20–29 están reservados para
 * uso interno de cada tienda (ningún fabricante los usa), así que no choca
 * con un producto de verdad. Y como es un EAN-13 válido, más adelante se
 * puede imprimir como etiqueta y escanear igual que los demás.
 */

const PREFIJO = '20';

/** Dígito de control de un EAN-13 (sobre los 12 primeros dígitos). */
export function digitoDeControl(doceDigitos: string): number {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(doceDigitos[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (suma % 10)) % 10;
}

export function generarCodigoInterno(): string {
  let cuerpo = PREFIJO;
  for (let i = 0; i < 10; i++) cuerpo += randomInt(10).toString();
  return cuerpo + digitoDeControl(cuerpo).toString();
}

export function esCodigoInterno(codigo: string): boolean {
  return /^20\d{11}$/.test(codigo);
}
