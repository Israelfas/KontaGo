// Billetes (y la moneda de $1) con los que suele pagar el cliente, en
// centavos. Dólar: es la moneda de Ecuador.
const BILLETES_CENTAVOS = [100, 200, 500, 1000, 2000, 5000, 10000];

/**
 * Botones de cobro rápido para la caja: los primeros billetes que cubren
 * el total (ej. total $4,10 → $5, $10, $20). "Monto exacto" va aparte.
 * Ahorra tipear el monto recibido en la mayoría de las ventas.
 */
export function montosRapidos(totalCentavos: number, cantidad = 3): number[] {
  return BILLETES_CENTAVOS.filter((b) => b > totalCentavos).slice(0, cantidad);
}

// Lo que va en el campo "Monto recibido" (se escribe con punto decimal).
export function centavosATexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}
