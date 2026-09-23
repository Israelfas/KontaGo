'use client';

import { useEffect, useRef, useState } from 'react';

// Montos y conteos tal como los arma formatearCentavos (es-EC): "$1.234,50",
// "−$0,55", "30". Lo que no calce con esto se muestra sin animar.
const PATRON = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([^\d]*)$/;

const DURACION_MS = 700;

function leer(texto: string) {
  const m = PATRON.exec(texto);
  if (!m) return null;
  const [, antes, entero, decimales = '', despues] = m;
  return {
    antes,
    despues,
    decimales: decimales.length,
    valor: Number(`${entero.replace(/\./g, '')}.${decimales || '0'}`),
  };
}

function armar(valor: number, decimales: number): string {
  const [entero, fraccion] = valor.toFixed(decimales).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraccion ? `${conMiles},${fraccion}` : conMiles;
}

// Frena al llegar, como algo que desliza y se detiene (sin rebote).
const frenar = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Un número que cuenta hasta su valor al aparecer y, si cambia (otro
 * período, un producto más en el carrito), sigue desde el que se está
 * viendo: nunca salta al valor viejo para volver a arrancar. El lector de
 * pantalla lee solo el valor final.
 */
export function CifraAnimada({ texto }: { texto: string }) {
  const destino = leer(texto);
  // Arranca en 0 (igual en el servidor y en el navegador: sin desajuste
  // de hidratación) y el efecto lo lleva hasta el valor.
  const [mostrado, setMostrado] = useState(0);
  const actual = useRef(0);
  const destinoValor = destino?.valor;

  useEffect(() => {
    if (destinoValor === undefined) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desde = actual.current;
    if (reducido || desde === destinoValor) {
      actual.current = destinoValor;
      setMostrado(destinoValor);
      return;
    }
    let cuadro = 0;
    // El reloj arranca en el primer cuadro dibujado.
    let inicio: number | null = null;
    const paso = (ahora: number) => {
      inicio ??= ahora;
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const valor = desde + (destinoValor - desde) * frenar(t);
      actual.current = valor;
      setMostrado(valor);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [destinoValor]);

  if (!destino) return <>{texto}</>;

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {destino.antes}
        {armar(mostrado, destino.decimales)}
        {destino.despues}
      </span>
      <span className="sr-only">{texto}</span>
    </>
  );
}
