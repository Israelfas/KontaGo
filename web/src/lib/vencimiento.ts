import { formatearFechaCorta } from './formato';

/** Días desde hoy hasta la fecha 'AAAA-MM-DD' (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(anio, mes - 1, dia).getTime() - hoy.getTime()) / 86_400_000);
}

export type TonoDeEstado = 'danger' | 'warning' | 'neutral';

/**
 * El vencimiento como se lee de un vistazo, con su urgencia: "Vencido",
 * "Vence hoy", "Vence en 3 días"… y la fecha cuando todavía falta.
 */
export function estadoDelVencimiento(fecha: string): { texto: string; tono: TonoDeEstado } {
  const dias = diasHasta(fecha);
  if (dias < 0) return { texto: `Vencido · ${formatearFechaCorta(fecha)}`, tono: 'danger' };
  if (dias === 0) return { texto: 'Vence hoy', tono: 'danger' };
  if (dias === 1) return { texto: 'Vence mañana', tono: 'warning' };
  if (dias <= 7) return { texto: `Vence en ${dias} días`, tono: 'warning' };
  return { texto: formatearFechaCorta(fecha), tono: 'neutral' };
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas"… desde una fecha ISO. */
export function haceCuanto(iso: string): string {
  const cuando = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(cuando);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}
