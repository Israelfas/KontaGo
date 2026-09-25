/*
 * Cantidades: unidades enteras, o peso (libras, kilos) con hasta 3
 * decimales. Las mismas reglas que el backend (common/cantidad.ts): toda
 * cuenta redondea a milésimas y los importes, al centavo.
 */

export type UnidadDeVenta = 'unidad' | 'libra' | 'kilo';

export const UNIDADES: { valor: UnidadDeVenta; texto: string; corto: string }[] = [
  { valor: 'unidad', texto: 'Por unidad', corto: 'u.' },
  { valor: 'libra', texto: 'Por libra', corto: 'lb' },
  { valor: 'kilo', texto: 'Por kilo', corto: 'kg' },
];

export function porPeso(unidad: UnidadDeVenta | undefined): boolean {
  return unidad === 'libra' || unidad === 'kilo';
}

export function redondear(cantidad: number): number {
  return Math.round(cantidad * 1000) / 1000;
}

/** Precio por cantidad, en centavos enteros (igual que el backend). */
export function importeCentavos(precioUnitarioCentavos: number, cantidad: number): number {
  return Math.round(precioUnitarioCentavos * redondear(cantidad));
}

/** El importe de `cantidad` después de `yaContado` (anulaciones por partes). */
export function importeDelTramo(
  precioUnitarioCentavos: number,
  yaContado: number,
  cantidad: number,
): number {
  return (
    importeCentavos(precioUnitarioCentavos, yaContado + cantidad) -
    importeCentavos(precioUnitarioCentavos, yaContado)
  );
}

const numero = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 });

/** "3", "0,5 lb", "1,25 kg". */
export function formatearCantidad(cantidad: number, unidad: UnidadDeVenta = 'unidad'): string {
  const texto = numero.format(cantidad);
  return porPeso(unidad) ? `${texto} ${unidad === 'libra' ? 'lb' : 'kg'}` : texto;
}

/** Para el precio: "" por unidad, " / lb", " / kg". */
export function precioPor(unidad: UnidadDeVenta = 'unidad'): string {
  return porPeso(unidad) ? ` / ${unidad === 'libra' ? 'lb' : 'kg'}` : '';
}

/**
 * Lo que escribió la persona ("0,5", "1.25", "2") como cantidad, o null si
 * no sirve: vacío, negativo, más de 3 decimales, o con decimales en algo
 * que va por unidad. `permitirCero` para stocks y mínimos.
 */
export function leerCantidad(
  texto: string,
  unidad: UnidadDeVenta = 'unidad',
  permitirCero = false,
): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(limpio) && !/^\.\d{1,3}$/.test(limpio)) return null;
  const valor = redondear(Number(limpio));
  if (!Number.isFinite(valor) || valor < 0 || (valor === 0 && !permitirCero)) return null;
  if (!porPeso(unidad) && !Number.isInteger(valor)) return null;
  return valor;
}

/** El paso del campo numérico: 1 por unidad, milésimas por peso. */
export function pasoDe(unidad: UnidadDeVenta = 'unidad'): string {
  return porPeso(unidad) ? '0.001' : '1';
}
