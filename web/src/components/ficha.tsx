/**
 * Ficha con iniciales: identifica de un vistazo a un producto, una
 * persona o un cliente en las listas. El color sale del nombre, así que
 * es siempre el mismo para el mismo nombre.
 */

const TONOS = [
  { fondo: 'rgba(217, 140, 43, 0.16)', texto: '#9a5f14' },
  { fondo: 'rgba(47, 143, 176, 0.14)', texto: '#1f6a85' },
  { fondo: 'rgba(47, 111, 79, 0.14)', texto: '#2f6f4f' },
  { fondo: 'rgba(138, 99, 201, 0.14)', texto: '#6a45a8' },
  { fondo: 'rgba(182, 70, 47, 0.12)', texto: '#a03d28' },
  { fondo: 'rgba(28, 43, 58, 0.09)', texto: '#1c2b3a' },
];

export function tonoDe(texto: string) {
  let suma = 0;
  for (const letra of texto) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return TONOS[suma % TONOS.length];
}

/** "Aceite La Favorita 1 L" → "AL": las dos primeras palabras con letras. */
export function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return (palabras[0]?.[0] ?? '?').concat(palabras[1]?.[0] ?? '').toUpperCase();
}

export function Ficha({
  nombre,
  semilla,
  tamano = 'normal',
  redonda = false,
}: {
  nombre: string;
  /** Lo que decide el color (la categoría, por ejemplo); si no, el nombre. */
  semilla?: string;
  tamano?: 'chica' | 'normal' | 'grande';
  /** Redonda para personas, cuadrada para cosas. */
  redonda?: boolean;
}) {
  const tono = tonoDe(semilla || nombre);
  return (
    <span
      className={`ficha-iniciales ${tamano === 'normal' ? '' : `ficha-iniciales-${tamano}`} ${redonda ? 'ficha-iniciales-redonda' : ''}`}
      style={{ background: tono.fondo, color: tono.texto }}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  );
}
