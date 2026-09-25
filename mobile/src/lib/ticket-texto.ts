import { Alert, Share } from 'react-native';
import { obtenerTicket, ApiError } from './api';
import { formatearCentavos, numeroDeTicket } from './formato';
import type { Ticket } from './tipos';
import { formatearCantidad } from './cantidad';

/**
 * El ticket como texto, para compartirlo por WhatsApp (o lo que elija el
 * cajero). Mismo contenido que el ticket impreso de la web
 * (web/src/app/ticket/[id]/page.tsx). Los asteriscos son negrita en
 * WhatsApp; en otras apps se ven como asteriscos, que no molestan.
 */
export function textoDelTicket(ticket: Ticket): string {
  const fecha = new Date(ticket.fecha);
  const cuando = `${fecha.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;

  const { tienda } = ticket;
  const lineas: string[] = [`*${tienda.nombre}*`];
  // La razón social solo si es distinta del nombre del letrero.
  if (tienda.razonSocial && tienda.razonSocial !== tienda.nombre) lineas.push(tienda.razonSocial);
  if (tienda.ruc) lineas.push(`RUC ${tienda.ruc}`);
  if (tienda.direccion) lineas.push(tienda.direccion);
  if (tienda.telefono) lineas.push(`Tel. ${tienda.telefono}`);
  lineas.push(
    '',
    `Ticket ${numeroDeTicket(ticket.numero)} · ${cuando}`,
    `Atendió: ${ticket.cajero}`,
    '',
  );
  for (const linea of ticket.lineas) {
    lineas.push(
      `${formatearCantidad(linea.cantidad, linea.unidad)} x ${linea.nombre} — ${formatearCentavos(linea.totalCentavos)}` +
        (linea.cantidadAnulada > 0 ? ` (anulado: ${formatearCantidad(linea.cantidadAnulada, linea.unidad)})` : ''),
    );
  }
  lineas.push('');
  if (ticket.subtotalConIvaCentavos > 0) {
    lineas.push(`Subtotal ${ticket.tarifaIva}%: ${formatearCentavos(ticket.subtotalConIvaCentavos)}`);
  }
  if (ticket.subtotalSinIvaCentavos > 0) {
    lineas.push(`Subtotal 0%: ${formatearCentavos(ticket.subtotalSinIvaCentavos)}`);
  }
  lineas.push(`IVA ${ticket.tarifaIva}%: ${formatearCentavos(ticket.ivaCentavos)}`);
  lineas.push(`*TOTAL: ${formatearCentavos(ticket.totalCentavos)}*`);
  lineas.push(
    ticket.metodoPago === 'transferencia'
      ? 'Pagado por transferencia'
      : ticket.metodoPago === 'fiado'
        ? `Al fiado · ${ticket.cliente ?? 'cliente'}`
        : `Efectivo: ${formatearCentavos(ticket.montoRecibidoCentavos)} · Vuelto: ${formatearCentavos(ticket.vueltoCentavos)}`,
  );
  if (ticket.anuladoCentavos > 0) {
    lineas.push(`Devuelto (anulación): -${formatearCentavos(ticket.anuladoCentavos)}`);
  }
  lineas.push('', '¡Gracias por su compra!');
  if (tienda.mensajeTicket) lineas.push(tienda.mensajeTicket);
  lineas.push('_Este ticket no reemplaza a la factura._');
  return lineas.join('\n');
}

/**
 * Pide el ticket y abre el menú de compartir del teléfono (WhatsApp,
 * mensajes, correo…). Si falla, avisa con un Alert: no hay pantalla
 * propia donde mostrar el error.
 */
export async function compartirTicket(token: string, ventaId: string): Promise<void> {
  try {
    const ticket = await obtenerTicket(token, ventaId);
    await Share.share({
      title: `Ticket ${numeroDeTicket(ticket.numero)}`,
      message: textoDelTicket(ticket),
    });
  } catch (err) {
    Alert.alert('No se pudo compartir el ticket', err instanceof ApiError ? err.message : '');
  }
}
