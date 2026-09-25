import { formatearFechaCorta } from './formato';
import { DIAS_POR_VENCER } from './filtro-productos';
import type { Lote, Producto } from './tipos';

/**
 * Lotes de un producto (unidades que vencen el mismo día). Copia en
 * mobile/src/lib/lotes.ts: cualquier cambio va en los dos lados.
 */

function hoy(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function unidades(n: number): string {
  return `${n.toLocaleString('es-EC', { maximumFractionDigits: 3 })} u.`;
}

/** "vence 24 sept", "venció 22 sept", "sin fecha". */
export function textoVencimiento(lote: Lote): string {
  if (!lote.fechaVencimiento) return 'sin fecha';
  return `${lote.fechaVencimiento < hoy() ? 'venció' : 'vence'} ${formatearFechaCorta(lote.fechaVencimiento)}`;
}

/** "1 u. vence 24 sept · 2 u. vence 2 oct". */
export function resumenDeLotes(producto: Producto): string {
  return (producto.lotes ?? [])
    .map((l) => `${unidades(l.cantidad)} ${textoVencimiento(l)}`)
    .join(' · ');
}

/** Lotes que vencen entre hoy y los próximos días (mismo plazo que las alertas). */
export function lotesPorVencer(producto: Producto, dias = DIAS_POR_VENCER): Lote[] {
  const desde = hoy();
  const hasta = enDias(dias);
  return (producto.lotes ?? []).filter(
    (l) =>
      l.fechaVencimiento !== null && l.fechaVencimiento >= desde && l.fechaVencimiento <= hasta,
  );
}

/** Lotes con unidades ya vencidos: hay que sacarlos de la góndola. */
export function lotesVencidos(producto: Producto): Lote[] {
  const desde = hoy();
  return (producto.lotes ?? []).filter(
    (l) => l.fechaVencimiento !== null && l.fechaVencimiento < desde,
  );
}

/** Tiene más de una fecha: "la fecha del producto" ya no alcanza para describirlo. */
export function tieneVariosLotes(producto: Producto): boolean {
  return (producto.lotes?.length ?? 0) > 1;
}
