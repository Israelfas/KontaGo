'use client';

import { useSyncExternalStore } from 'react';

// Mismo corte que el breakpoint `md` de Tailwind: por debajo, las tablas
// anchas no entran (table-shell corta lo que sobra) y se muestran como
// tarjetas.
const CONSULTA = '(max-width: 767px)';

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

/**
 * true en celulares. Se decide en JS y no con clases `md:hidden` porque
 * las dos versiones (tabla y tarjetas) tienen formularios con estado e
 * ids propios: renderizar ambas y ocultar una los duplicaría.
 */
export function usePantallaChica(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false, // en el servidor no hay pantalla: se asume escritorio
  );
}
