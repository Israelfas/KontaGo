import { formatearCentavos } from './formato';

/**
 * Ayudas para el arqueo de caja. Copia en web/src/lib/caja.ts:
 * cualquier cambio va en los dos lados.
 */

// Lo que hay en un cajón en Ecuador (dólar): billetes y monedas, en
// centavos. La moneda de $1 existe (Sacagawea y la ecuatoriana).
export const DENOMINACIONES: { centavos: number; texto: string; tipo: 'billete' | 'moneda' }[] = [
  { centavos: 10000, texto: '$100', tipo: 'billete' },
  { centavos: 5000, texto: '$50', tipo: 'billete' },
  { centavos: 2000, texto: '$20', tipo: 'billete' },
  { centavos: 1000, texto: '$10', tipo: 'billete' },
  { centavos: 500, texto: '$5', tipo: 'billete' },
  { centavos: 100, texto: '$1', tipo: 'moneda' },
  { centavos: 50, texto: '50¢', tipo: 'moneda' },
  { centavos: 25, texto: '25¢', tipo: 'moneda' },
  { centavos: 10, texto: '10¢', tipo: 'moneda' },
  { centavos: 5, texto: '5¢', tipo: 'moneda' },
  { centavos: 1, texto: '1¢', tipo: 'moneda' },
];

/** Total de un conteo { centavos de la denominación → cantidad }. */
export function totalDelConteo(conteo: Record<number, number>): number {
  return DENOMINACIONES.reduce((acc, d) => acc + d.centavos * (conteo[d.centavos] || 0), 0);
}

// Fondos iniciales típicos para abrir la caja.
export const FONDOS_RAPIDOS = [0, 1000, 2000, 5000];

/** "Cuadra", "Faltan $2,50", "Sobran $0,30". */
export function textoDiferencia(diferenciaCentavos: number): string {
  if (diferenciaCentavos === 0) return 'Cuadra';
  const monto = formatearCentavos(Math.abs(diferenciaCentavos));
  return diferenciaCentavos < 0 ? `Faltan ${monto}` : `Sobran ${monto}`;
}

export type TonoDiferencia = 'ok' | 'falta' | 'sobra';

export function tonoDiferencia(diferenciaCentavos: number): TonoDiferencia {
  return diferenciaCentavos === 0 ? 'ok' : diferenciaCentavos < 0 ? 'falta' : 'sobra';
}

/** "07:45" de una fecha ISO. */
export function horaDe(iso: string): string {
  // 24 horas, como el resto de la app ("20:48", no "08:48 p. m.").
  return new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}
