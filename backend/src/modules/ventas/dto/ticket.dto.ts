import { MetodoPago } from '../../../common/enums/metodo-pago.enum';
import type { TiendaDto } from '../../tenants/dto/tienda.dto';
import type { UnidadDeVenta } from '../../../common/cantidad';

/**
 * Lo que va impreso (o compartido) en el ticket de una venta. Muestra la
 * venta como se cobró; si después se anuló algo, va aparte.
 *
 * No es un comprobante tributario: la factura electrónica del SRI es otra
 * cosa (con RUC, clave de acceso, autorización).
 */
export interface TicketDto {
  // Nombre (el del letrero) y, si se cargaron, RUC, dirección, etc.
  tienda: TiendaDto;
  numero: number;
  fecha: Date;
  cajero: string;
  metodoPago: MetodoPago;
  // Al fiado: a quién se le fió.
  cliente: string | null;
  lineas: {
    nombre: string;
    // La cantidad está en esta unidad (libras si se vende por peso).
    unidad: UnidadDeVenta;
    cantidad: number;
    precioUnitarioCentavos: number;
    totalCentavos: number;
    // Unidades de esta línea anuladas después.
    cantidadAnulada: number;
  }[];
  // Desglose como en Ecuador: base de lo que lleva IVA, base de lo que no
  // (tarifa 0%) y el IVA. Suman el total.
  subtotalConIvaCentavos: number;
  subtotalSinIvaCentavos: number;
  ivaCentavos: number;
  // Tarifa general vigente, en % (para imprimir "IVA 15%").
  tarifaIva: number;
  totalCentavos: number;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  // Lo devuelto por anulaciones (0 si no hubo).
  anuladoCentavos: number;
}
