export class ResumenDelDiaDto {
  fecha: string; // YYYY-MM-DD
  cantidadVentas: number;
  ingresoBrutoCentavos: number; // lo cobrado menos lo anulado
  gananciaCentavos: number; // suma de márgenes (venta - costo), no el ingreso bruto
  ivaCentavos: number; // IVA contenido en el ingreso bruto (ya incluido en los precios)
  anuladoCentavos: number; // devuelto a clientes por anulaciones (ya descontado de lo anterior)
}
