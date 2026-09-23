import type { ReactNode } from 'react';
import { CifraAnimada } from './cifra';

// Los montos que llegan como texto cuentan hasta su valor al aparecer.
const animar = (valor: ReactNode) =>
  typeof valor === 'string' ? <CifraAnimada texto={valor} /> : valor;

/**
 * Encabezado inmersivo: una franja oscura a todo el ancho que lleva EL
 * número de la pantalla, y debajo una "hoja" de papel que sube por
 * encima de ella.
 *
 * Reemplaza al título suelto sobre fondo beige: así cada pantalla tiene
 * un ancla visual, el dato importante pesa, y en el celular se distingue
 * de un vistazo qué es lo principal y qué es el detalle.
 */
export function Banda({
  eyebrow,
  titulo,
  valor,
  detalle,
  accion,
  extra,
}: {
  eyebrow: string;
  titulo: string;
  valor?: ReactNode;
  detalle?: ReactNode;
  accion?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <header className="banda">
      <div className="app-container">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="banda-eyebrow">{eyebrow}</p>
            <h1 className="banda-titulo">{titulo}</h1>
          </div>
          {accion && <div className="shrink-0">{accion}</div>}
        </div>

        {valor !== undefined && <p className="banda-valor">{animar(valor)}</p>}
        {detalle && <p className="banda-detalle">{detalle}</p>}
        {extra}
      </div>
    </header>
  );
}

/** El papel que tapa el borde inferior de la franja. */
export function Hoja({ children }: { children: ReactNode }) {
  return (
    <div className="hoja">
      <div className="app-container">{children}</div>
    </div>
  );
}

/** Pieza del mosaico: etiqueta arriba, número grande, detalle al pie. */
export function Pieza({
  etiqueta,
  valor,
  detalle,
  tono = 'neutro',
  ancho,
  children,
}: {
  etiqueta: string;
  valor?: ReactNode;
  detalle?: ReactNode;
  tono?: 'neutro' | 'verde' | 'rojo';
  ancho?: 'normal' | 'mitad' | 'completa';
  children?: ReactNode;
}) {
  const clases = [
    'pieza',
    tono === 'verde' ? 'pieza-acento-verde' : '',
    tono === 'rojo' ? 'pieza-acento-rojo' : '',
    ancho === 'mitad' ? 'pieza-mitad' : '',
    ancho === 'completa' ? 'pieza-completa' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={clases}>
      <p className="pieza-etiqueta">{etiqueta}</p>
      {valor !== undefined && <p className="pieza-valor">{animar(valor)}</p>}
      {children}
      {detalle && <p className="pieza-detalle">{detalle}</p>}
    </article>
  );
}
