'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatearCentavos } from '@/lib/formato';
import { aFecha, fechaLarga } from '@/lib/periodo';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import type { PuntoSerie } from '@/lib/tipos';
import { formatearCantidad, porPeso, type UnidadDeVenta } from '@/lib/cantidad';

/**
 * Gráficos del resumen, en SVG a mano (sin librería: son formas simples
 * y así el bundle no crece ~100 KB).
 *
 * Lo que se respeta:
 * - Una sola serie por gráfico → un solo color (el ámbar de la marca). El
 *   degradado es de relleno (se desvanece hacia abajo), nunca por valor.
 * - Rejilla y ejes tenues, siempre por detrás del dato.
 * - Cada punto tiene tooltip al pasar el mouse y al enfocarlo con el
 *   teclado, y además hay una tabla con todos los valores: el tooltip
 *   agrega comodidad, nunca es la única forma de leer el dato.
 * - Las animaciones se apagan con "reducir movimiento" (globals.css).
 */

// Posición de cada elemento, para que entren uno detrás de otro.
const orden = (i: number) => ({ '--i': i }) as CSSProperties;

// Un id que sirva dentro de url(#…): el de React trae caracteres raros.
function useIdSvg(): string {
  return `g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * El ancho real del contenedor, para dibujar a escala 1:1: si el SVG se
 * estira, los textos del eje se agrandan con él (y quedaban enormes).
 */
function useAnchoReal(inicial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState<number | null>(null);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      setAncho(Math.round(entrada.contentRect.width));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, Math.max(280, ancho ?? inicial)] as const;
}

/** Escala "linda" para el eje: 1, 2, 2,5 o 5 × potencia de 10. */
function techoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  for (const paso of [1, 2, 2.5, 5, 10]) {
    if (valor <= paso * exp) return paso * exp;
  }
  return 10 * exp;
}

interface Punto {
  x: number;
  y: number;
}

/**
 * Curva suave que pasa por todos los puntos sin inventar picos ni valles
 * (interpolación monótona): entre dos horas no puede aparecer un valor
 * más alto que ambas, ni uno negativo.
 */
function curvaSuave(p: Punto[]): string {
  const n = p.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  if (n === 0) return '';
  if (n === 1) return `M${f(p[0].x)},${f(p[0].y)}`;
  const pendiente: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    pendiente.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x));
  }
  const m: number[] = new Array(n);
  m[0] = pendiente[0];
  m[n - 1] = pendiente[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = pendiente[i - 1] * pendiente[i] <= 0 ? 0 : (pendiente[i - 1] + pendiente[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (pendiente[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / pendiente[i];
    const b = m[i + 1] / pendiente[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * pendiente[i];
      m[i + 1] = t * b * pendiente[i];
    }
  }
  let camino = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1].x - p[i].x) / 3;
    camino += ` C${f(p[i].x + h)},${f(p[i].y + m[i] * h)} ${f(p[i + 1].x - h)},${f(
      p[i + 1].y - m[i + 1] * h,
    )} ${f(p[i + 1].x)},${f(p[i + 1].y)}`;
  }
  return camino;
}

/** Cómo se lee cada punto según la serie sea por hora o por día. */
function textosDelPunto(punto: PuntoSerie, agrupadoPor: 'hora' | 'dia', muchos: boolean) {
  if (agrupadoPor === 'hora') {
    return {
      eje: `${punto.etiqueta}h`,
      corto: `${punto.etiqueta}h`,
      detalle: `${punto.etiqueta}:00 a ${punto.etiqueta}:59`,
    };
  }
  const fecha = aFecha(punto.etiqueta);
  const dia = fecha.getDate();
  const conSemana = `${fecha.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')} ${dia}`;
  return {
    // Con pocos días, el día de la semana ayuda ("sáb 20"); con un mes
    // entero no entra, alcanza con el número.
    eje: muchos ? String(dia) : conSemana,
    corto: conSemana,
    detalle: fechaLarga(punto.etiqueta),
  };
}

function Tooltip({
  izquierda,
  arriba,
  children,
}: {
  izquierda: string;
  arriba: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tooltip"
      className="grafico-tooltip pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl px-3 py-2 text-xs"
      style={{ left: izquierda, top: `calc(${arriba} - 14px)` }}
    >
      {children}
    </div>
  );
}

/** Un dato destacado arriba del gráfico ("Hora pico", "Promedio…"). */
function DatoDelGrafico({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grafico-dato">
      <span className="grafico-dato-etiqueta">{etiqueta}</span>
      <span className="grafico-dato-valor">{valor}</span>
    </div>
  );
}

/**
 * Lo cobrado a lo largo del período: por hora si es un día, por día si es
 * un rango. Va sobre la tarjeta oscura (.pieza-oscura).
 */
export function GraficoIngreso({
  datos,
  agrupadoPor,
  titulo,
  compacto = false,
}: {
  datos: PuntoSerie[];
  agrupadoPor: 'hora' | 'dia';
  titulo: string;
  /** Más bajo, para acompañar una lista (Ventas) sin taparla. */
  compacto?: boolean;
}) {
  const [elegido, setActivo] = useState<number | null>(null);
  // Si cambió el período, el punto elegido puede no existir más.
  const activo = elegido !== null && elegido < datos.length ? elegido : null;
  const pantallaChica = usePantallaChica();
  const idTitulo = useId();
  const id = useIdSvg();
  const [refContenedor, ancho] = useAnchoReal(pantallaChica ? 330 : 720);

  const encabezado = (extra?: ReactNode) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="pieza-etiqueta">{titulo}</p>
        <p className="mt-1 text-xs text-papel/60">Lo cobrado, ya descontado lo anulado</p>
      </div>
      {extra}
    </div>
  );

  if (datos.length === 0) {
    return (
      <>
        {encabezado()}
        <p className="mt-6 text-sm text-papel/70">Todavía no hay ventas para graficar.</p>
      </>
    );
  }

  const alto = pantallaChica ? (compacto ? 170 : 200) : compacto ? 190 : 270;
  const margen = { arriba: 30, derecha: 14, abajo: 26, izquierda: pantallaChica ? 38 : 48 };
  const anchoTrazado = ancho - margen.izquierda - margen.derecha;
  const altoTrazado = alto - margen.arriba - margen.abajo;
  const base = margen.arriba + altoTrazado;

  const maximo = Math.max(...datos.map((d) => d.centavos));
  const techo = techoRedondo(maximo);
  const banda = anchoTrazado / datos.length;
  const puntos = datos.map((d, i) => ({
    x: margen.izquierda + banda * (i + 0.5),
    y: base - (d.centavos / techo) * altoTrazado,
  }));
  const indiceMaximo = datos.findIndex((d) => d.centavos === maximo);
  const muchos = datos.length > 10;
  const textos = datos.map((d) => textosDelPunto(d, agrupadoPor, muchos));
  // Con muchos puntos, una etiqueta cada tanto: si no, se pisan.
  const saltoEtiquetas = pantallaChica
    ? Math.ceil(datos.length / (agrupadoPor === 'dia' && !muchos ? 7 : 5))
    : Math.ceil(datos.length / (agrupadoPor === 'dia' ? (muchos ? 14 : 7) : 12));

  const linea = curvaSuave(puntos);
  const area =
    puntos.length > 1
      ? `${linea} L${puntos[puntos.length - 1].x},${base} L${puntos[0].x},${base} Z`
      : '';
  const conVentas = datos.filter((d) => d.centavos > 0);
  const promedio = conVentas.length
    ? Math.round(conVentas.reduce((acc, d) => acc + d.centavos, 0) / conVentas.length)
    : 0;
  const pico = puntos[indiceMaximo];
  // La etiqueta del pico, sin salirse por los costados.
  const xEtiquetaPico = Math.min(Math.max(pico.x, margen.izquierda + 34), ancho - 36);

  return (
    <>
      {encabezado(
        maximo > 0 && (
          <div className="flex flex-wrap gap-2">
            <DatoDelGrafico
              etiqueta={agrupadoPor === 'hora' ? 'Hora pico' : 'Mejor día'}
              valor={textos[indiceMaximo].corto}
            />
            <DatoDelGrafico
              etiqueta={agrupadoPor === 'hora' ? 'Promedio por hora' : 'Promedio por día'}
              valor={formatearCentavos(promedio)}
            />
          </div>
        ),
      )}

      <div ref={refContenedor} className="relative mt-4">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className="w-full overflow-visible"
          role="img"
          aria-labelledby={idTitulo}
        >
          <title id={idTitulo}>
            {agrupadoPor === 'hora'
              ? 'Ingreso cobrado por hora del día'
              : 'Ingreso cobrado por día'}
          </title>
          <defs>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2a93b" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#d98c2b" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#d98c2b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-linea`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e8943a" />
              <stop offset="100%" stopColor="#ffd08a" />
            </linearGradient>
            <filter id={`${id}-brillo`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="4" result="difuso" />
              <feMerge>
                <feMergeNode in="difuso" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = base - altoTrazado * f;
            return (
              <g key={f}>
                <line
                  x1={margen.izquierda}
                  x2={ancho - margen.derecha}
                  y1={y}
                  y2={y}
                  stroke="rgba(246, 243, 236, 0.09)"
                  strokeWidth={1}
                  strokeDasharray={f === 0 ? undefined : '3 5'}
                />
                {(f === 0 || f === 0.5 || f === 1) && (
                  <text
                    x={margen.izquierda - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-papel/55 font-ticket text-[11px]"
                  >
                    {formatearCentavos(techo * f).replace(',00', '')}
                  </text>
                )}
              </g>
            );
          })}

          {puntos.length > 1 ? (
            <>
              <path d={area} fill={`url(#${id}-area)`} className="grafico-area" />
              <path
                d={linea}
                pathLength={1}
                fill="none"
                stroke={`url(#${id}-linea)`}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${id}-brillo)`}
                className="grafico-linea"
              />
            </>
          ) : (
            // Un solo punto (una sola hora con ventas): una columna de luz.
            <rect
              x={pico.x - 14}
              y={pico.y}
              width={28}
              height={Math.max(0, base - pico.y)}
              rx={8}
              fill={`url(#${id}-area)`}
              className="grafico-area"
            />
          )}

          {/* Los puntos: marcan cada hora (o día) sin tapar la curva. */}
          {datos.length <= 31 &&
            puntos.map((p, i) => (
              <circle
                key={datos[i].etiqueta}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill="#ffd08a"
                opacity={activo === i ? 0 : 0.7}
                className="grafico-punto"
                style={orden(i)}
              />
            ))}

          {/* El pico: late suave para que el ojo vaya ahí primero. */}
          {maximo > 0 && (
            <g pointerEvents="none">
              <circle cx={pico.x} cy={pico.y} r={6} fill="#f2a93b" className="grafico-pulso" />
              <circle
                cx={pico.x}
                cy={pico.y}
                r={5.5}
                fill="#ffd08a"
                stroke="#16232f"
                strokeWidth={2.5}
              />
              {activo === null && (
                <g className="grafico-punto" style={orden(datos.length)}>
                  <rect
                    x={xEtiquetaPico - 32}
                    y={pico.y - 30}
                    width={64}
                    height={19}
                    rx={9.5}
                    fill="#ffd08a"
                  />
                  <text
                    x={xEtiquetaPico}
                    y={pico.y - 17}
                    textAnchor="middle"
                    className="fill-tinta font-ticket text-[10px] font-semibold"
                  >
                    {formatearCentavos(maximo)}
                  </text>
                </g>
              )}
            </g>
          )}

          {activo !== null && (
            <g pointerEvents="none">
              <line
                x1={puntos[activo].x}
                x2={puntos[activo].x}
                y1={margen.arriba - 6}
                y2={base}
                stroke="rgba(255, 208, 138, 0.55)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <circle
                cx={puntos[activo].x}
                cy={puntos[activo].y}
                r={6}
                fill="#fffdf8"
                stroke="#f2a93b"
                strokeWidth={3}
              />
            </g>
          )}

          {datos.map((d, i) => (
            <g key={d.etiqueta}>
              {/* Zona de contacto: toda la franja de ese punto. */}
              <rect
                x={margen.izquierda + banda * i}
                y={margen.arriba - 10}
                width={banda}
                height={altoTrazado + 10}
                fill="transparent"
                tabIndex={0}
                role="button"
                className="outline-none"
                aria-label={`${textos[i].detalle}: ${formatearCentavos(d.centavos)}`}
                onPointerEnter={() => setActivo(i)}
                onPointerLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
              {i % saltoEtiquetas === 0 && (
                <text
                  x={puntos[i].x}
                  y={alto - 6}
                  textAnchor="middle"
                  className={`text-[11px] ${activo === i ? 'fill-papel' : 'fill-papel/55'}`}
                >
                  {textos[i].eje}
                </text>
              )}
            </g>
          ))}
        </svg>

        {activo !== null && (
          <Tooltip
            // Centrado en el punto, pero sin salirse por los costados.
            izquierda={`${Math.min(84, Math.max(16, (puntos[activo].x / ancho) * 100))}%`}
            arriba={`${(puntos[activo].y / alto) * 100}%`}
          >
            <span className="block font-ticket text-sm font-semibold">
              {formatearCentavos(datos[activo].centavos)}
            </span>
            <span className="whitespace-nowrap text-papel/70">{textos[activo].detalle}</span>
          </Tooltip>
        )}
      </div>
    </>
  );
}

/** Mini curva para una tarjeta: la forma del período, sin ejes. */
export function Sparkline({ datos, etiqueta }: { datos: number[]; etiqueta: string }) {
  const id = useIdSvg();
  if (datos.length < 2) return null;
  const ancho = 120;
  const alto = 34;
  const maximo = Math.max(...datos, 1);
  const puntos = datos.map((v, i) => ({
    x: (i / (datos.length - 1)) * ancho,
    y: alto - 3 - (v / maximo) * (alto - 6),
  }));
  const linea = curvaSuave(puntos);
  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      preserveAspectRatio="none"
      className="mt-3 h-9 w-full"
      role="img"
      aria-label={etiqueta}
    >
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d98c2b" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#d98c2b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${linea} L${ancho},${alto} L0,${alto} Z`}
        fill={`url(#${id}-area)`}
        className="grafico-area"
      />
      <path
        d={linea}
        pathLength={1}
        fill="none"
        stroke="#b06f1c"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="grafico-linea"
      />
    </svg>
  );
}

/** Anillo chico con un porcentaje (qué parte de lo vendido es IVA…). */
export function Anillo({
  porcentaje,
  color,
  etiqueta,
}: {
  porcentaje: number;
  color: string;
  etiqueta: string;
}) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  const texto = valor > 0 && valor < 1 ? '<1%' : `${Math.round(valor)}%`;
  return (
    <div className="anillo" role="img" aria-label={`${etiqueta}: ${texto}`}>
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
        <circle cx={22} cy={22} r={17} fill="none" stroke="var(--papel-linea)" strokeWidth={5} />
        {valor > 0 && (
          <circle
            cx={22}
            cy={22}
            r={17}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.max(valor, 1.5)} 100`}
            className="anillo-arco"
          />
        )}
      </svg>
      <span className="anillo-texto">{texto}</span>
    </div>
  );
}

export interface PuntoProducto {
  nombre: string;
  // unidades está en esta unidad (libras si se vende por peso).
  unidad?: UnidadDeVenta;
  unidades: number;
  centavos: number;
}

/** Ranking de lo más vendido: puesto, barra de unidades y lo cobrado. */
export function GraficoTopProductos({
  datos,
  cuando = 'hoy',
}: {
  datos: PuntoProducto[];
  /** Para el lector de pantalla: "hoy", "en los últimos 7 días"… */
  cuando?: string;
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-tinta-suave">Todavía no hay ventas para graficar.</p>;
  }

  const maximo = Math.max(...datos.map((d) => d.unidades));

  return (
    <ol className="space-y-4" aria-label={`Productos más vendidos ${cuando}, por unidades`}>
      {datos.map((d, i) => (
        <li
          key={d.nombre}
          className="producto-top grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3"
        >
          <span className={`puesto puesto-${Math.min(i + 1, 4)}`} aria-hidden>
            {i + 1}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-tinta" title={d.nombre}>
                {d.nombre}
              </span>
              <span className="shrink-0 font-ticket text-xs text-tinta-suave">
                {formatearCentavos(d.centavos)}
              </span>
            </div>
            <div className="producto-pista mt-1.5">
              <div
                className="producto-relleno barra-fila"
                style={{ width: `${Math.max(3, (d.unidades / maximo) * 100)}%`, ...orden(i) }}
              />
            </div>
          </div>
          <span className="min-w-13 text-right leading-tight">
            <span className="block font-ticket text-sm font-semibold text-tinta">
              {formatearCantidad(d.unidades, d.unidad)}
            </span>
            <span className="text-[10px] text-tinta-suave">
              {porPeso(d.unidad) ? 'vendidas' : d.unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const FORMAS_DE_PAGO = [
  { clave: 'efectivo', nombre: 'Efectivo', nota: null, color: '#d98c2b' },
  { clave: 'transferencia', nombre: 'Transferencia', nota: null, color: '#2f8fb0' },
  { clave: 'fiado', nombre: 'Al fiado', nota: 'por cobrar', color: '#8a63c9' },
] as const;

/** Dona con lo vendido según cómo se pagó. */
export function GraficoPagos({
  efectivoCentavos,
  transferenciaCentavos,
  fiadoCentavos,
}: {
  efectivoCentavos: number;
  transferenciaCentavos: number;
  fiadoCentavos: number;
}) {
  const [elegido, setActivo] = useState<string | null>(null);
  const montos: Record<(typeof FORMAS_DE_PAGO)[number]['clave'], number> = {
    efectivo: efectivoCentavos,
    transferencia: transferenciaCentavos,
    fiado: fiadoCentavos,
  };
  const total = efectivoCentavos + transferenciaCentavos + fiadoCentavos;

  if (total <= 0) {
    return <p className="text-sm text-tinta-suave">Todavía no hay ventas para graficar.</p>;
  }

  const segmentos = FORMAS_DE_PAGO.map((forma) => ({
    ...forma,
    centavos: montos[forma.clave],
    porcentaje: (montos[forma.clave] / total) * 100,
  }));
  // Cada porción arranca donde terminó la anterior.
  const conMonto = segmentos
    .filter((s) => s.centavos > 0)
    .map((s, i, lista) => ({
      ...s,
      desde: lista.slice(0, i).reduce((acc, previa) => acc + previa.porcentaje, 0),
    }));
  const activo = conMonto.find((s) => s.clave === elegido) ?? null;
  // Un hueco chico entre porciones, solo si hay más de una.
  const hueco = conMonto.length > 1 ? 1.4 : 0;
  const porcentajeTexto = (p: number) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={60} cy={60} r={46} fill="none" stroke="var(--papel-linea)" strokeWidth={14} />
          {conMonto.map((s, i) => {
            const largo = Math.max(0.5, s.porcentaje - hueco);
            return (
              <circle
                key={s.clave}
                cx={60}
                cy={60}
                r={46}
                fill="none"
                stroke={s.color}
                strokeWidth={activo?.clave === s.clave ? 18 : 14}
                strokeLinecap={hueco > 0 ? 'butt' : 'round'}
                pathLength={100}
                strokeDasharray={`${largo} ${100 - largo}`}
                strokeDashoffset={-s.desde}
                opacity={activo && activo.clave !== s.clave ? 0.35 : 1}
                className="dona-segmento"
                style={orden(i)}
                onPointerEnter={() => setActivo(s.clave)}
                onPointerLeave={() => setActivo(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-suave">
            {activo ? activo.nombre : 'Vendido'}
          </span>
          <span className="font-ticket text-lg font-semibold tracking-tight text-tinta">
            {formatearCentavos(activo ? activo.centavos : total)}
          </span>
          {activo && (
            <span className="text-xs text-tinta-suave">{porcentajeTexto(activo.porcentaje)}</span>
          )}
        </div>
      </div>

      <ul className="space-y-2" aria-label="Lo vendido según cómo se pagó">
        {segmentos.map((s, i) => (
          <li
            key={s.clave}
            tabIndex={s.centavos > 0 ? 0 : undefined}
            className={`pago-fila ${activo?.clave === s.clave ? 'pago-fila-activa' : ''} ${
              s.centavos === 0 ? 'opacity-50' : ''
            }`}
            onPointerEnter={() => s.centavos > 0 && setActivo(s.clave)}
            onPointerLeave={() => setActivo(null)}
            onFocus={() => s.centavos > 0 && setActivo(s.clave)}
            onBlur={() => setActivo(null)}
          >
            <span className="pago-color" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-tinta">
                  {s.nombre}
                  {s.nota && (
                    <span className="ml-1.5 text-[11px] font-normal text-tinta-suave">
                      {s.nota}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-ticket text-sm font-semibold text-tinta">
                  {formatearCentavos(s.centavos)}
                </span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="pago-pista">
                  <span
                    className="pago-relleno barra-fila"
                    style={{ width: `${s.porcentaje}%`, background: s.color, ...orden(i) }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-ticket text-[11px] text-tinta-suave">
                  {porcentajeTexto(s.porcentaje)}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
