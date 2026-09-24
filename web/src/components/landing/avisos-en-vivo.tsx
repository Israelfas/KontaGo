'use client';

import { useEffect, useState } from 'react';
import { AlertIcon, CashIcon, CheckIcon } from '../icons';
import { usePrefiereMenosMovimiento } from './carrusel';

const AVISOS = [
  { icono: CashIcon, tono: 'verde', titulo: 'Venta #129', detalle: '$3,40 · efectivo' },
  { icono: AlertIcon, tono: 'ambar', titulo: 'Leche Vita 1 L', detalle: 'quedan 3 · stock bajo' },
  { icono: CheckIcon, tono: 'verde', titulo: 'Caja de Carlos', detalle: 'cerrada · cuadra' },
  { icono: CashIcon, tono: 'verde', titulo: 'Venta #130', detalle: '$1,25 · transferencia' },
  { icono: AlertIcon, tono: 'rojo', titulo: 'Yogurt Toni', detalle: 'vence en 2 días' },
] as const;

const CADA_MS = 3600;

/**
 * Los avisos que la app muestra en vivo, uno a la vez, flotando sobre la
 * maqueta del hero. Solo corren con la pestaña visible; con menos
 * movimiento queda fijo el primero.
 */
export function AvisosEnVivo() {
  const [indice, setIndice] = useState(0);
  const quieto = usePrefiereMenosMovimiento();

  useEffect(() => {
    if (quieto) return;
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndice((i) => (i + 1) % AVISOS.length);
    }, CADA_MS);
    return () => window.clearInterval(intervalo);
  }, [quieto]);

  const aviso = AVISOS[indice];
  const Icono = aviso.icono;
  return (
    <div className="avisos-en-vivo" aria-hidden="true">
      <div key={indice} className="aviso-flotante">
        <span className={`aviso-flotante-icono aviso-${aviso.tono}`}>
          <Icono className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.8rem] font-semibold text-tinta">
            {aviso.titulo}
          </span>
          <span className="block truncate text-[0.72rem] text-tinta-suave">{aviso.detalle}</span>
        </span>
      </div>
    </div>
  );
}
