import type { Producto } from './tipos';

export type FiltroProductos = 'todos' | 'stock_bajo' | 'por_vencer';

// Mismo plazo que las alertas por defecto del backend (ALERTAS_DIAS_VENCIMIENTO).
export const DIAS_POR_VENCER = 7;

// Sin tildes ni mayúsculas: "yogur" encuentra "Yogurt", "limon" a "Limón".
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

/**
 * El código que el sistema le puso a un producto que no traía código de
 * barras (EAN-13 con prefijo 20, reservado para uso interno de la tienda).
 */
export function esCodigoInterno(codigo: string): boolean {
  return /^20\d{11}$/.test(codigo);
}

/** Cómo se muestra el código: el interno no le dice nada a nadie. */
export function textoDelCodigo(codigo: string): string {
  return esCodigoInterno(codigo) ? 'Sin código' : codigo;
}

/**
 * Para la caja: los productos cuyo nombre tiene todas las palabras
 * buscadas ("coca 1" encuentra "Coca Cola 1L"). Primero los que empiezan
 * con lo buscado.
 */
export function buscarPorNombre(productos: Producto[], busqueda: string, limite = 8): Producto[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const encontrados = productos.filter((p) => {
    const nombre = normalizar(p.nombre);
    return palabras.every((palabra) => nombre.includes(palabra));
  });
  const empieza = (p: Producto) => (normalizar(p.nombre).startsWith(palabras[0]) ? 0 : 1);
  return encontrados
    .sort((a, b) => empieza(a) - empieza(b) || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite);
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
