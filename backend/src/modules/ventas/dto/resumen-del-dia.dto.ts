export class ResumenDelDiaDto {
  fecha: string; // YYYY-MM-DD
  cantidadVentas: number;
  ingresoBrutoCentavos: number; // suma de totalCentavos de las ventas
  gananciaCentavos: number; // suma de márgenes (venta - costo), no el ingreso bruto
}
