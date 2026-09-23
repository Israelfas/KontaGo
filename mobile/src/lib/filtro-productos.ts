import type { Producto } from './tipos';

export type FiltroProductos = 'todos' | 'stock_bajo' | 'por_vencer';

// Mismo plazo que las alertas por defecto del backend (ALERTAS_DIAS_VENCIMIENTO).
export const DIAS_POR_VENCER = 7;

// Sin tildes ni mayúsculas: "yogur" encuentra "Yogurt", "limon" a "Limón".
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fechaLocal(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function tieneStockBajo(p: Producto): boolean {
  return p.stockMinimo > 0 && p.stock <= p.stockMinimo;
}

/**
 * Vence dentro de los próximos DIAS_POR_VENCER días — o ya venció: a
 * diferencia de las alertas, acá interesa también lo vencido que sigue
 * en el catálogo con stock (hay que sacarlo de la góndola).
 */
export function estaPorVencer(p: Producto): boolean {
  if (!p.fechaVencimiento) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_POR_VENCER);
  return p.fechaVencimiento <= fechaLocal(limite); // 'AAAA-MM-DD' se compara como texto
}

export function filtrarProductos(
  productos: Producto[],
  busqueda: string,
  filtro: FiltroProductos,
): Producto[] {
  const q = normalizar(busqueda);
  return productos.filter((p) => {
    if (filtro === 'stock_bajo' && !tieneStockBajo(p)) return false;
    if (filtro === 'por_vencer' && !estaPorVencer(p)) return false;
    if (!q) return true;
    return normalizar(p.nombre).includes(q) || p.codigoBarras.includes(q);
  });
}
