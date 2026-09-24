/**
 * Física de resorte para lo que se arrastra (el carrusel). Se piensa con
 * los dos parámetros de Apple en vez de masa/rigidez:
 *
 * - amortiguacion: 1 = llega sin pasarse; menos de 1 = se pasa y vuelve.
 * - respuesta: qué tan rápido llega, en segundos (no es una duración fija).
 *
 * A diferencia de una transición CSS, un resorte arranca desde donde está
 * y con la velocidad que trae: se puede agarrar en pleno movimiento y
 * soltar con impulso sin que se note la costura.
 */
export interface Resorte {
  amortiguacion: number;
  respuesta: number;
}

/** Lo de siempre: se acomoda sin rebotar. */
export const SIN_REBOTE: Resorte = { amortiguacion: 1, respuesta: 0.4 };
/** Solo si lo tiraron con impulso: un rebote leve, porque hubo un gesto. */
export const CON_IMPULSO: Resorte = { amortiguacion: 0.82, respuesta: 0.38 };

/** Avanza el resorte dt segundos, en pasos cortos para que sea estable. */
export function avanzar(
  posicion: number,
  velocidad: number,
  destino: number,
  { amortiguacion, respuesta }: Resorte,
  dt: number,
): [number, number] {
  const rigidez = ((2 * Math.PI) / respuesta) ** 2;
  const friccion = (4 * Math.PI * amortiguacion) / respuesta;
  let x = posicion;
  let v = velocidad;
  for (let resto = dt; resto > 0; resto -= 1 / 240) {
    const h = Math.min(resto, 1 / 240);
    v += (-rigidez * (x - destino) - friccion * v) * h;
    x += v * h;
  }
  return [x, v];
}

/**
 * Hasta dónde llegaría algo soltado a esa velocidad (px/s), frenando como
 * el scroll de iOS (0.998). Con esto se elige la diapositiva: un tirón
 * corto pero rápido pasa a la siguiente aunque no haya cruzado la mitad, y
 * un movimiento lento vuelve a su lugar.
 */
export function proyectar(velocidad: number, desaceleracion = 0.998): number {
  return ((velocidad / 1000) * desaceleracion) / (1 - desaceleracion);
}

/** Pasado el borde, cada vez sigue menos al dedo, en vez de frenar en seco. */
export function elastico(exceso: number, dimension: number, constante = 0.55): number {
  return (exceso * dimension * constante) / (dimension + constante * Math.abs(exceso));
}
