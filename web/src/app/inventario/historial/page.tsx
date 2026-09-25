'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja, Pieza } from '@/components/banda';
import { InventoryIcon } from '@/components/icons';
import { SelectorPeriodo, usePeriodoDeLaURL } from '@/components/selector-periodo';
import { useAuth } from '@/lib/auth-context';
import {
  listarMovimientosInventario,
  listarProductos,
  obtenerResumenInventario,
  ApiError,
} from '@/lib/api';
import { formatearCentavos, formatearFechaCorta } from '@/lib/formato';
import { esHoy, fechaISO, fechaLarga, hoyISO, nombreDelPeriodo, rangoLegible } from '@/lib/periodo';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type MovimientoDelHistorial,
  type Producto,
  type ResumenInventarioPeriodo,
  type TipoMovimientoInventario,
} from '@/lib/tipos';
import { formatearCantidad, porPeso } from '@/lib/cantidad';

const POR_PAGINA = 50;
// Mismo color de serie que el resto de los gráficos (ver graficos.tsx).
const SERIE = '#b06f1c';

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Una lista corta con una barra proporcional al monto (el mayor = 100%). */
function ListaConBarras({
  titulo,
  filas,
  vacio,
}: {
  titulo: string;
  filas: { clave: string; texto: string; detalle: string; centavos: number }[];
  vacio: string;
}) {
  const maximo = Math.max(...filas.map((f) => f.centavos), 1);
  return (
    <div className="pieza pieza-mitad">
      <p className="pieza-etiqueta">{titulo}</p>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filas.map((f, i) => (
            <li key={f.clave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-tinta" title={f.texto}>
                  {f.texto}
                  <span className="ml-1.5 text-xs text-tinta-suave">{f.detalle}</span>
                </span>
                <span className="shrink-0 font-ticket text-tinta">
                  {formatearCentavos(f.centavos)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-papel-linea/60" aria-hidden="true">
                <div
                  className="barra-fila h-1.5 rounded-full"
                  style={
                    {
                      width: `${Math.max(2, (f.centavos / maximo) * 100)}%`,
                      background: SERIE,
                      '--i': i,
                    } as CSSProperties
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaMovimiento({ m }: { m: MovimientoDelHistorial }) {
  const esMerma = m.tipo === 'merma';
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-papel-linea py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm text-tinta">
          <span className="font-ticket text-xs text-tinta-suave">{hora(m.createdAt)}</span>{' '}
          <span
            className={`status-pill ml-1 text-[0.7rem] ${esMerma ? 'status-pill-danger' : 'status-pill-ok'}`}
          >
            {esMerma ? `Merma · ${ETIQUETAS_MOTIVO_MERMA[m.motivo ?? 'otro']}` : 'Abastecimiento'}
          </span>{' '}
          <span className="font-medium">{m.producto.nombre}</span>
        </p>
        <p className="mt-0.5 text-xs text-tinta-suave">
          {porPeso(m.producto.unidad)
            ? formatearCantidad(m.cantidad, m.producto.unidad)
            : `${m.cantidad} u.`}{' '}
          × {formatearCentavos(m.costoUnitarioCentavos)}
          {m.proveedor && ` · ${m.proveedor}`}
          {m.vencimientoLote && ` · lote vence ${formatearFechaCorta(m.vencimientoLote)}`}
          {` · ${m.registradoPor}`}
        </p>
      </div>
      <span
        className={`shrink-0 font-ticket text-sm font-semibold ${esMerma ? 'text-rojo-perdida' : 'text-tinta'}`}
      >
        {esMerma ? '−' : ''}
        {formatearCentavos(m.totalCentavos)}
      </span>
    </li>
  );
}

const TIPOS: { valor: TipoMovimientoInventario | undefined; texto: string }[] = [
  { valor: undefined, texto: 'Todo' },
  { valor: 'abastecimiento', texto: 'Abastecimientos' },
  { valor: 'merma', texto: 'Mermas' },
];

function ContenidoHistorial() {
  const { token } = useAuth();
  const [periodo, setPeriodo] = usePeriodoDeLaURL();
  const [tipo, setTipo] = useState<TipoMovimientoInventario | undefined>(undefined);
  const [productoId, setProductoId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [resumen, setResumen] = useState<ResumenInventarioPeriodo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoDelHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!token) return;
    listarProductos(token)
      .then(setProductos)
      .catch(() => setProductos([]));
  }, [token]);

  useEffect(() => {
    if (!token || !periodo) return;
    let vigente = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerResumenInventario(token, periodo),
      listarMovimientosInventario(token, periodo, {
        tipo,
        productoId: productoId || undefined,
        limite: POR_PAGINA,
      }),
    ])
      .then(([r, pagina]) => {
        if (!vigente) return;
        setResumen(r);
        setMovimientos(pagina.movimientos);
        setTotal(pagina.total);
      })
      .catch((err) => {
        if (vigente)
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [token, periodo, tipo, productoId, intento]);

  async function cargarMas() {
    if (!token || !periodo) return;
    setCargandoMas(true);
    try {
      const pagina = await listarMovimientosInventario(token, periodo, {
        tipo,
        productoId: productoId || undefined,
        limite: POR_PAGINA,
        desplazamiento: movimientos.length,
      });
      setMovimientos((previos) => {
        const vistos = new Set(previos.map((m) => m.id));
        return [...previos, ...pagina.movimientos.filter((m) => !vistos.has(m.id))];
      });
      setTotal(pagina.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar más movimientos');
    } finally {
      setCargandoMas(false);
    }
  }

  // Agrupados por día (vienen del más reciente al más viejo).
  const grupos: { dia: string; movimientos: MovimientoDelHistorial[] }[] = [];
  for (const m of movimientos) {
    const dia = fechaISO(new Date(m.createdAt));
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.movimientos.push(m);
    else grupos.push({ dia, movimientos: [m] });
  }
  const hoy = periodo ? esHoy(periodo) : true;
  const deHoy = hoyISO();

  return (
    <div>
      <Banda
        eyebrow={periodo && !hoy ? `Inventario · ${rangoLegible(periodo)}` : 'Inventario · hoy'}
        titulo={periodo && !hoy ? nombreDelPeriodo(periodo) : 'Historial de inventario'}
        valor={resumen ? formatearCentavos(resumen.egresoCentavos) : undefined}
        detalle={
          resumen
            ? `Gastado en mercadería (${resumen.cantidadAbastecimientos} compra${
                resumen.cantidadAbastecimientos === 1 ? '' : 's'
              }) · ${formatearCentavos(resumen.perdidaCentavos)} perdidos en ${resumen.cantidadMermas} merma${
                resumen.cantidadMermas === 1 ? '' : 's'
              }.`
            : undefined
        }
        accion={
          <Link href="/inventario" className="button button-claro">
            <InventoryIcon className="h-4 w-4" />
            Inventario
          </Link>
        }
        extra={periodo && <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />}
      />

      <Hoja>
        <div className="mt-4 space-y-5">
          {error && (
            <ErrorState
              action={
                <Button variant="secondary" onClick={() => setIntento((n) => n + 1)}>
                  Reintentar
                </Button>
              }
            >
              {error}
            </ErrorState>
          )}
          {cargando && !resumen && <LoadingState label="Cargando historial…" />}

          {resumen && !error && (
            <div
              className={`space-y-5 transition-opacity ${cargando ? 'opacity-60' : ''}`}
              aria-busy={cargando}
            >
              <div className="mosaico">
                <Pieza
                  etiqueta="Gastado en mercadería"
                  valor={formatearCentavos(resumen.egresoCentavos)}
                  detalle={`${resumen.cantidadAbastecimientos} compra${resumen.cantidadAbastecimientos === 1 ? '' : 's'}`}
                />
                <Pieza
                  etiqueta="Perdido por mermas"
                  valor={formatearCentavos(resumen.perdidaCentavos)}
                  tono={resumen.perdidaCentavos > 0 ? 'rojo' : 'neutro'}
                  detalle={
                    resumen.egresoCentavos > 0 && resumen.perdidaCentavos > 0
                      ? `${((resumen.perdidaCentavos / resumen.egresoCentavos) * 100).toFixed(1)}% de lo comprado`
                      : `${resumen.cantidadMermas} merma${resumen.cantidadMermas === 1 ? '' : 's'}`
                  }
                />
                <ListaConBarras
                  titulo="Por qué se pierde"
                  vacio="Sin pérdidas en este período."
                  filas={resumen.perdidaPorMotivo.map((m) => ({
                    clave: m.motivo,
                    texto: ETIQUETAS_MOTIVO_MERMA[m.motivo],
                    detalle: `${m.unidades} u.`,
                    centavos: m.centavos,
                  }))}
                />
                <ListaConBarras
                  titulo="Lo que más se pierde"
                  vacio="Sin pérdidas en este período."
                  filas={resumen.productosConMasPerdida.map((p) => ({
                    clave: p.nombre,
                    texto: p.nombre,
                    detalle: `${p.unidades} u.`,
                    centavos: p.centavos,
                  }))}
                />
                <ListaConBarras
                  titulo="A quién le compras"
                  vacio="Sin compras en este período."
                  filas={resumen.porProveedor.map((p) => ({
                    clave: p.proveedor ?? '—',
                    texto: p.proveedor ?? 'Sin proveedor cargado',
                    detalle: `${p.compras} compra${p.compras === 1 ? '' : 's'}`,
                    centavos: p.centavos,
                  }))}
                />
              </div>

              <section className="app-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Tipo de movimiento"
                  >
                    {TIPOS.map((t) => (
                      <button
                        key={t.texto}
                        type="button"
                        aria-pressed={tipo === t.valor}
                        onClick={() => setTipo(t.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          tipo === t.valor
                            ? 'border-tinta bg-tinta text-papel'
                            : 'border-papel-linea bg-white text-tinta'
                        }`}
                      >
                        {t.texto}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="filtro-producto" className="sr-only">
                    Producto
                  </label>
                  <select
                    id="filtro-producto"
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className="field !mb-0 !min-h-0 !w-auto !py-1.5 text-sm sm:ml-auto"
                  >
                    <option value="">Todos los productos</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {movimientos.length === 0 && !cargando ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={<InventoryIcon className="h-6 w-6" />}
                      title="Sin movimientos"
                      description="No hubo abastecimientos ni mermas con estos filtros en este período."
                    />
                  </div>
                ) : (
                  grupos.map((g) => (
                    <div key={g.dia} className="mt-4">
                      <h2 className="border-b border-papel-linea pb-1.5 font-display text-sm font-semibold text-tinta">
                        {g.dia === deHoy
                          ? 'Hoy'
                          : fechaLarga(g.dia)[0].toUpperCase() + fechaLarga(g.dia).slice(1)}
                      </h2>
                      <ul>
                        {g.movimientos.map((m) => (
                          <FilaMovimiento key={m.id} m={m} />
                        ))}
                      </ul>
                    </div>
                  ))
                )}

                {movimientos.length < total && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-tinta-suave">
                      Mostrando {movimientos.length} de {total}
                    </p>
                    <Button variant="secondary" onClick={cargarMas} disabled={cargandoMas}>
                      {cargandoMas
                        ? 'Cargando…'
                        : `Ver ${Math.min(POR_PAGINA, total - movimientos.length)} más`}
                    </Button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </Hoja>
    </div>
  );
}

export default function HistorialInventarioPage() {
  return (
    <RutaProtegida soloAdmin>
      <Nav />
      <ContenidoHistorial />
    </RutaProtegida>
  );
}
