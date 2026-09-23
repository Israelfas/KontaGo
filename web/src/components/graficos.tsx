'use client';

import { useId, useState, type CSSProperties } from 'react';

// Posición de cada barra, para que crezcan una detrás de otra (ver .barra-columna).
const orden = (i: number) => ({ '--i': i }) as CSSProperties;
import { formatearCentavos } from '@/lib/formato';
import { aFecha, fechaLarga } from '@/lib/periodo';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import type { PuntoSerie } from '@/lib/tipos';

/**
 * Gráficos del resumen, en SVG a mano (sin librería: son dos
 * formas simples y así el bundle no crece ~100 KB).
 *
 * Reglas de la guía de visualización que se respetan acá:
 * - Una sola serie por gráfico → un solo color, sin leyenda (el título
 *   ya dice qué se está midiendo). Nunca un degradado por valor: eso
 *   codifica dos veces lo que el largo de la barra ya dice.
 * - Barras de 24px como máximo, con el extremo redondeado 4px y cuadrado
 *   contra la línea base.
 * - Rejilla y ejes de 1px, en gris, siempre por detrás del dato.
 * - Los textos usan los colores de texto, nunca el color de la serie.
 * - Cada barra tiene tooltip al pasar el mouse y al enfocarla con el
 *   teclado, y además hay una tabla con todos los valores: el tooltip
 *   agrega comodidad, nunca es la única forma de leer el dato.
 */

// Ámbar de la marca, un paso más oscuro: el #d98c2b original queda en
// 2,67:1 contra la superficie de las tarjetas y no llega al mínimo de
// 3:1; este da 4,02:1.
const SERIE = '#b06f1c';
const REJILLA = 'var(--papel-linea)';
const GROSOR_MAXIMO = 24;

function Tooltip({
  izquierda,
  arriba,
  children,
}: {
  izquierda: string;
  arriba: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-papel-linea px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: izquierda, top: `calc(${arriba} - 8px)`, background: 'var(--superficie)' }}
    >
      {children}
    </div>
  );
}

/** Barra vertical con las esquinas de arriba redondeadas (4px). */
function caminoColumna(x: number, y: number, ancho: number, alto: number): string {
  const r = Math.min(4, ancho / 2, alto);
  return `M${x},${y + alto} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + ancho - r},${y} Q${x + ancho},${y} ${x + ancho},${y + r} L${x + ancho},${y + alto} Z`;
}

/** Barra horizontal con las esquinas de la derecha redondeadas (4px). */
function caminoBarra(x: number, y: number, ancho: number, alto: number): string {
  const r = Math.min(4, alto / 2, ancho);
  return `M${x},${y} L${x + ancho - r},${y} Q${x + ancho},${y} ${x + ancho},${y + r} L${x + ancho},${y + alto - r} Q${x + ancho},${y + alto} ${x + ancho - r},${y + alto} L${x},${y + alto} Z`;
}

/** Escala "linda" para el eje: 1, 2 o 5 × potencia de 10. */
function techoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  for (const paso of [1, 2, 2.5, 5, 10]) {
    if (valor <= paso * exp) return paso * exp;
  }
  return 10 * exp;
}

/** Cómo se lee cada punto según la serie sea por hora o por día. */
function textosDelPunto(punto: PuntoSerie, agrupadoPor: 'hora' | 'dia', muchos: boolean) {
  if (agrupadoPor === 'hora') {
    return {
      eje: `${punto.etiqueta}h`,
      detalle: `${punto.etiqueta}:00 a ${punto.etiqueta}:59`,
    };
  }
  const fecha = aFecha(punto.etiqueta);
  const dia = fecha.getDate();
  return {
    // Con pocos días, el día de la semana ayuda ("sáb 20"); con un mes
    // entero no entra, alcanza con el número.
    eje: muchos
      ? String(dia)
      : `${fecha.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')} ${dia}`,
    detalle: fechaLarga(punto.etiqueta),
  };
}

export function GraficoIngreso({
  datos,
  agrupadoPor,
}: {
  datos: PuntoSerie[];
  agrupadoPor: 'hora' | 'dia';
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const pantallaChica = usePantallaChica();
  const idTitulo = useId();

  if (datos.length === 0) {
    return <p className="text-sm text-tinta-suave">Todavía no hay ventas para graficar.</p>;
  }

  const ancho = pantallaChica ? 330 : 640;
  const alto = pantallaChica ? 170 : 200;
  const margen = { arriba: 16, derecha: 8, abajo: 26, izquierda: pantallaChica ? 36 : 44 };
  const anchoTrazado = ancho - margen.izquierda - margen.derecha;
  const altoTrazado = alto - margen.arriba - margen.abajo;

  const maximo = Math.max(...datos.map((d) => d.centavos));
  const techo = techoRedondo(maximo);
  const banda = anchoTrazado / datos.length;
  // El hueco entre barras vecinas lo hace el espacio, no un borde. Con
  // muchos días (hasta 92) la banda es angosta y el hueco se achica.
  const grosor = Math.min(GROSOR_MAXIMO, Math.max(2, banda - Math.min(8, banda * 0.35)));
  const indiceMaximo = datos.findIndex((d) => d.centavos === maximo);
  const muchos = datos.length > 10;
  const textos = datos.map((d) => textosDelPunto(d, agrupadoPor, muchos));
  // Con muchos puntos, una etiqueta cada tanto: si no, se pisan.
  const saltoEtiquetas = pantallaChica
    ? Math.ceil(datos.length / (agrupadoPor === 'dia' && !muchos ? 7 : 5))
    : Math.ceil(datos.length / (agrupadoPor === 'dia' ? (muchos ? 12 : 7) : 9));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full"
        role="img"
        aria-labelledby={idTitulo}
      >
        <title id={idTitulo}>
          {agrupadoPor === 'hora' ? 'Ingreso cobrado por hora del día' : 'Ingreso cobrado por día'}
        </title>

        {[0, 0.5, 1].map((f) => {
          const y = margen.arriba + altoTrazado * (1 - f);
          return (
            <g key={f}>
              <line
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={y}
                y2={y}
                stroke={REJILLA}
                strokeWidth={1}
              />
              <text
                x={margen.izquierda - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-tinta-suave text-[10px]"
              >
                {formatearCentavos(techo * f).replace(',00', '')}
              </text>
            </g>
          );
        })}

        {datos.map((d, i) => {
          const altoBarra = techo > 0 ? (d.centavos / techo) * altoTrazado : 0;
          const x = margen.izquierda + banda * i + (banda - grosor) / 2;
          const y = margen.arriba + altoTrazado - altoBarra;
          return (
            <g key={d.etiqueta}>
              {/* Zona de contacto más grande que la barra. */}
              <rect
                x={margen.izquierda + banda * i}
                y={margen.arriba}
                width={banda}
                height={altoTrazado}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${textos[i].detalle}: ${formatearCentavos(d.centavos)}`}
                onPointerEnter={() => setActivo(i)}
                onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
              {altoBarra > 0 && (
                <path
                  d={caminoColumna(x, y, grosor, altoBarra)}
                  className="barra-columna"
                  style={orden(i)}
                  fill={SERIE}
                  opacity={activo === null || activo === i ? 1 : 0.55}
                  pointerEvents="none"
                />
              )}
              {i === indiceMaximo && altoBarra > 0 && (
                <text
                  // Pegado a un borde, el texto se saldría del dibujo.
                  x={Math.min(Math.max(x + grosor / 2, margen.izquierda + 24), ancho - 26)}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-tinta text-[10px] font-semibold"
                >
                  {formatearCentavos(d.centavos)}
                </text>
              )}
              {i % saltoEtiquetas === 0 && (
                <text
                  x={margen.izquierda + banda * i + banda / 2}
                  y={alto - 8}
                  textAnchor="middle"
                  className="fill-tinta-suave text-[10px]"
                >
                  {textos[i].eje}
                </text>
              )}
            </g>
          );
        })}

        <line
          x1={margen.izquierda}
          x2={ancho - margen.derecha}
          y1={margen.arriba + altoTrazado}
          y2={margen.arriba + altoTrazado}
          stroke={REJILLA}
          strokeWidth={1}
        />
      </svg>

      {activo !== null && (
        <Tooltip
          // Centrado en la barra, pero sin salirse por los costados.
          izquierda={`${Math.min(80, Math.max(20, ((margen.izquierda + banda * activo + banda / 2) / ancho) * 100))}%`}
          arriba={`${
            ((margen.arriba +
              altoTrazado -
              (techo > 0 ? (datos[activo].centavos / techo) * altoTrazado : 0)) /
              alto) *
            100
          }%`}
        >
          <span className="block font-ticket font-semibold text-tinta">
            {formatearCentavos(datos[activo].centavos)}
          </span>
          <span className="whitespace-nowrap text-tinta-suave">{textos[activo].detalle}</span>
        </Tooltip>
      )}
    </div>
  );
}

export interface PuntoProducto {
  nombre: string;
  unidades: number;
  centavos: number;
}

export function GraficoTopProductos({
  datos,
  cuando = 'hoy',
}: {
  datos: PuntoProducto[];
  /** Para el lector de pantalla: "hoy", "en los últimos 7 días"… */
  cuando?: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const idTitulo = useId();

  if (datos.length === 0) {
    return <p className="text-sm text-tinta-suave">Todavía no hay ventas para graficar.</p>;
  }

  const maximo = Math.max(...datos.map((d) => d.unidades));
  const altoFila = 34;

  return (
    <div className="relative">
      <ul className="space-y-1" aria-labelledby={idTitulo}>
        <span id={idTitulo} className="sr-only">
          Productos más vendidos {cuando}, por unidades
        </span>
        {datos.map((d, i) => (
          <li
            key={d.nombre}
            className="grid grid-cols-[9rem_minmax(0,1fr)_3rem] items-center gap-3"
            style={{ height: altoFila }}
            tabIndex={0}
            onPointerEnter={() => setActivo(i)}
            onPointerLeave={() => setActivo(null)}
            onFocus={() => setActivo(i)}
            onBlur={() => setActivo(null)}
          >
            <span className="truncate text-sm text-tinta" title={d.nombre}>
              {d.nombre}
            </span>
            <svg
              viewBox="0 0 300 18"
              preserveAspectRatio="none"
              className="h-4 w-full"
              role="presentation"
            >
              <path
                d={caminoBarra(0, 0, Math.max(2, (d.unidades / maximo) * 300), 18)}
                className="barra-fila"
                style={orden(i)}
                fill={SERIE}
                opacity={activo === null || activo === i ? 1 : 0.55}
              />
            </svg>
            <span className="text-right font-ticket text-sm text-tinta">{d.unidades}</span>
          </li>
        ))}
      </ul>

      {activo !== null && (
        <div className="mt-2 text-xs text-tinta-suave">
          <span className="font-ticket font-semibold text-tinta">
            {formatearCentavos(datos[activo].centavos)}
          </span>{' '}
          cobrados en {datos[activo].unidades} unidad
          {datos[activo].unidades === 1 ? '' : 'es'} de {datos[activo].nombre}
        </div>
      )}
    </div>
  );
}
