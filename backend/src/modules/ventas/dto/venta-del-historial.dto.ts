import { MetodoPago } from '../../../common/enums/metodo-pago.enum';
import type { UnidadDeVenta } from '../../../common/cantidad';

/**
 * Una venta tal como se muestra en el historial del día. A propósito NO
 * incluye costos (costoUnitarioCentavos) ni ganancia: el historial lo ve
 * también el cajero, y eso es información del dueño.
 */
export interface VentaDelHistorialDto {
  id: string;
  // Número de ticket (1, 2, 3… por tienda).
  numero: number;
  createdAt: Date;
  vendedor: string;
  totalCentavos: number;
  totalAnuladoCentavos: number;
  metodoPago: MetodoPago;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  estado: 'completa' | 'parcialmente_anulada' | 'anulada';
  // Al fiado: a quién (null en las demás).
  cliente: { id: string; nombre: string } | null;
  items: {
    id: string;
    productoId: string;
    nombre: string;
    codigoBarras: string;
    // La cantidad está en esta unidad (libras si se vende por peso).
    unidad: UnidadDeVenta;
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
