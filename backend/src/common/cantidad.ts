import type { ColumnOptions } from 'typeorm';

/*
 * Cantidades: unidades enteras, o peso (libras, kilos) con hasta 3
 * decimales. En la base son numeric(12,3), exactas; en JavaScript son
 * números, así que toda cuenta con ellas pasa por redondear() para que no
 * aparezcan cosas como 0.30000000000000004 (y un stock que "no alcanza"
 * por una diezmilésima).
 *
 * Los montos siguen en centavos enteros: importeCentavos() redondea al
 * centavo el precio por la cantidad.
 */

export enum UnidadDeVenta {
  UNIDAD = 'unidad',
  LIBRA = 'libra',
  KILO = 'kilo',
}

export const DECIMALES_CANTIDAD = 3;

/** Redondea a milésimas (lo que guarda la base). */
export function redondear(cantidad: number): number {
  return Math.round(cantidad * 1000) / 1000;
}

export function sumar(a: number, b: number): number {
  return redondear(a + b);
}

export function restar(a: number, b: number): number {
  return redondear(a - b);
}

/**
 * Precio por cantidad, en centavos enteros. Con unidades enteras es la
 * multiplicación exacta de siempre.
 */
export function importeCentavos(
  precioUnitarioCentavos: number,
  cantidad: number,
): number {
  return Math.round(precioUnitarioCentavos * redondear(cantidad));
}

/**
 * El importe de `cantidad` después de `yaContado`: la diferencia entre los
 * acumulados. Así, sumando los tramos (anulaciones parciales de una misma
 * línea) da exactamente el importe del total, sin centavos sueltos.
 */
export function importeDelTramo(
  precioUnitarioCentavos: number,
  yaContado: number,
  cantidad: number,
): number {
  return (
    importeCentavos(precioUnitarioCentavos, sumar(yaContado, cantidad)) -
    importeCentavos(precioUnitarioCentavos, yaContado)
  );
}

/** Columna de cantidad: numeric(12,3) en la base, número en el código. */
export function columnaCantidad(
  opciones: Omit<
    ColumnOptions,
    'type' | 'precision' | 'scale' | 'transformer'
  > = {},
): ColumnOptions {
  return {
    ...opciones,
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: {
      to: (valor: number | null | undefined) => valor,
      // Postgres devuelve numeric como texto (para no perder precisión).
      from: (valor: string | null) => (valor === null ? null : Number(valor)),
    },
  };
}
