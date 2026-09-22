/**
 * Una venta tal como se muestra en el historial del día. A propósito NO
 * incluye costos (costoUnitarioCentavos) ni ganancia: el historial lo ve
 * también el cajero, y eso es información del dueño.
 */
export interface VentaDelHistorialDto {
  id: string;
  createdAt: Date;
  vendedor: string;
  totalCentavos: number;
  totalAnuladoCentavos: number;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  estado: 'completa' | 'parcialmente_anulada' | 'anulada';
  items: {
    id: string;
    productoId: string;
    nombre: string;
    codigoBarras: string;
    cantidad: number;
    cantidadAnulada: number;
    precioVentaCentavos: number;
  }[];
  anulaciones: {
    id: string;
    createdAt: Date;
    anuladoPor: string;
    motivo: string;
    montoDevueltoCentavos: number;
  }[];
}
