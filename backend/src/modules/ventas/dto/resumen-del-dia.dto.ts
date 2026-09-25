import type { UnidadDeVenta } from '../../../common/cantidad';

export class ResumenDelDiaDto {
  fecha: string; // YYYY-MM-DD
  cantidadVentas: number;
  ingresoBrutoCentavos: number; // lo cobrado menos lo anulado
  gananciaCentavos: number; // suma de márgenes (venta - costo), no el ingreso bruto
  ivaCentavos: number; // IVA contenido en el ingreso bruto (ya incluido en los precios)
  anuladoCentavos: number; // devuelto a clientes por anulaciones (ya descontado de lo anterior)
}

/** Un punto del gráfico: una hora ('8'…'23') o un día ('AAAA-MM-DD'). */
export interface PuntoSerie {
  etiqueta: string;
  centavos: number;
}

export interface ProductoVendido {
  nombre: string;
  // unidades está en esta unidad (libras si se vende por peso).
  unidad: UnidadDeVenta;
  unidades: number;
  centavos: number;
}

/**
 * Resumen de un período (un día o un rango). Extiende al del día para que
 * /ventas/resumen-dia siga respondiendo lo mismo que antes.
 */
export class ResumenPeriodoDto extends ResumenDelDiaDto {
  desde: string; // AAAA-MM-DD, incluido
  hasta: string; // AAAA-MM-DD, incluido
  dias: number;
  // Lo cobrado (neto de anulaciones) según cómo se pagó.
  efectivoCentavos: number;
  transferenciaCentavos: number;
  // Vendido al fiado (no cobrado todavía).
  fiadoCentavos: number;
  // Un día se grafica por hora; un rango, por día.
  agrupadoPor: 'hora' | 'dia';
  serie: PuntoSerie[];
  topProductos: ProductoVendido[];
}
