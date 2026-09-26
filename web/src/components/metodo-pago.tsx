import type { ReactNode } from 'react';
import { CashIcon, NotebookIcon, TransferIcon } from './icons';
import type { MetodoPago } from '@/lib/tipos';

/**
 * Cómo se pagó, siempre con el mismo color e ícono en toda la app (los
 * mismos de la dona del resumen): efectivo ámbar, transferencia azul,
 * fiado violeta.
 */
const METODOS: Record<MetodoPago, { nombre: string; clase: string; icono: ReactNode }> = {
  efectivo: {
    nombre: 'Efectivo',
    clase: 'chip-pago-efectivo',
    icono: <CashIcon className="h-3.5 w-3.5" />,
  },
  transferencia: {
    nombre: 'Transferencia',
    clase: 'chip-pago-transferencia',
    icono: <TransferIcon className="h-3.5 w-3.5" />,
  },
  fiado: {
    nombre: 'Al fiado',
    clase: 'chip-pago-fiado',
    icono: <NotebookIcon className="h-3.5 w-3.5" />,
  },
};

export function ChipMetodoPago({ metodo, detalle }: { metodo: MetodoPago; detalle?: string }) {
  const m = METODOS[metodo];
  return (
    <span className={`chip-pago ${m.clase}`}>
      {m.icono}
      {m.nombre}
      {detalle && <span className="chip-pago-detalle">· {detalle}</span>}
    </span>
  );
}
