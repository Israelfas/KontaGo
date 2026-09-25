import { UnidadDeVenta } from '../../common/cantidad';
import { CantidadConDecimalesError } from './productos.errors';

/**
 * Lo que va por unidad se cuenta en enteros: media Coca-Cola no existe. Lo
 * que va por peso (libra, kilo) acepta hasta 3 decimales (eso ya lo
 * revisó la validación del pedido).
 */
export function revisarCantidad(
  producto: { nombre: string; unidad: UnidadDeVenta },
  cantidad: number,
): void {
  if (producto.unidad === UnidadDeVenta.UNIDAD && !Number.isInteger(cantidad)) {
    throw new CantidadConDecimalesError(producto.nombre);
  }
}
