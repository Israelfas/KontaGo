/**
 * Cómo pagó el cliente. Solo el efectivo entra al cajón (y al arqueo);
 * la transferencia (Deuna, banco) va directo a la cuenta de la tienda; el
 * fiado no se cobra ahora: queda como deuda del cliente (ver fiados/).
 */
export enum MetodoPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  FIADO = 'fiado',
}
