'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { Ficha } from '@/components/ficha';
import { ChipMetodoPago } from '@/components/metodo-pago';
import { GraficoIngreso } from '@/components/graficos';
import { ReceiptIcon, RefreshIcon } from '@/components/icons';
import { SelectorPeriodo, usePeriodoDeLaURL } from '@/components/selector-periodo';
import { BotonExcel } from '@/components/boton-excel';
import { useAuth } from '@/lib/auth-context';
import {
  obtenerVentasDeHoy,
  anularVenta,
  buscarVentaPorNumero,
  listarVentas,
  obtenerResumen,
  ApiError,
} from '@/lib/api';
import { formatearCentavos, numeroDeTicket } from '@/lib/formato';
import {
  esHoy,
  fechaISO,
  fechaLarga,
  hoyISO,
  nombreDelPeriodo,
  periodoDeHoy,
  rangoLegible,
  type Periodo,
} from '@/lib/periodo';
import type { PaginaDeVentas, ResumenPeriodo, VentaDelHistorial } from '@/lib/tipos';
import {
  formatearCantidad,
  importeCentavos,
  importeDelTramo,
  pasoDe,
  porPeso,
  redondear,
} from '@/lib/cantidad';

// De a cuántas ventas se traen en el historial (un mes pasa de mil).
const POR_PAGINA = 50;

// Solo se marca lo que tiene algo anulado: "Completa" en cada tarjeta era
// ruido (es lo normal).
const ESTADO: Record<VentaDelHistorial['estado'], { texto: string; clase: string } | null> = {
  completa: null,
  parcialmente_anulada: { texto: 'Anulada en parte', clase: 'status-pill-warning' },
  anulada: { texto: 'Anulada', clase: 'status-pill-danger' },
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Por defecto propone anular todo lo que queda; se puede bajar la
// cantidad de cada producto para anular solo una parte.
function PanelAnulacion({
  venta,
  onAnulada,
  onCerrar,
}: {
  venta: VentaDelHistorial;
  onAnulada: (v: VentaDelHistorial) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const pendientes = venta.items
    .map((item) => ({ ...item, pendiente: redondear(item.cantidad - item.cantidadAnulada) }))
    .filter((item) => item.pendiente > 0);
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(pendientes.map((item) => [item.id, item.pendiente])),
  );
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Por tramos, como el backend: anular todo en partes devuelve lo cobrado.
  const aDevolverCentavos = pendientes.reduce(
    (acc, item) =>
      acc +
      importeDelTramo(item.precioVentaCentavos, item.cantidadAnulada, cantidades[item.id] ?? 0),
    0,
  );
  const anulaTodo = pendientes.every((item) => cantidades[item.id] === item.pendiente);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || aDevolverCentavos === 0) return;
    setError(null);
    setEnviando(true);
    try {
      const actualizada = await anularVenta(token, venta.id, {
        motivo,
        items: anulaTodo
          ? undefined
          : pendientes
              .filter((item) => (cantidades[item.id] ?? 0) > 0)
              .map((item) => ({ ventaItemId: item.id, cantidad: cantidades[item.id] })),
      });
      onAnulada(actualizada);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anular la venta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={manejarSubmit}
      className="mt-4 rounded-lg border border-rojo-perdida/30 bg-rojo-perdida/5 p-4"
    >
      <p className="text-sm font-semibold text-tinta">¿Qué se anula?</p>
      <div className="mt-3 space-y-2">
        {pendientes.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor={`anular-${item.id}`} className="text-tinta">
              {item.nombre}
              <span className="ml-1 text-xs text-tinta-suave">
                (de {formatearCantidad(item.pendiente, item.unidad)})
              </span>
            </label>
            <input
              id={`anular-${item.id}`}
              type="number"
              min={0}
              max={item.pendiente}
              step={pasoDe(item.unidad)}
              value={cantidades[item.id] ?? 0}
              onChange={(e) => {
                // Por unidad, enteros; por peso, hasta milésimas.
                const leido = porPeso(item.unidad)
                  ? redondear(parseFloat(e.target.value) || 0)
                  : parseInt(e.target.value, 10) || 0;
                const valor = Math.max(0, Math.min(item.pendiente, leido));
                setCantidades((prev) => ({ ...prev, [item.id]: valor }));
              }}
              className="field font-ticket !mb-0 w-20 !py-1.5 text-right"
            />
          </div>
        ))}
      </div>

      <label className="field-label mt-4" htmlFor={`motivo-${venta.id}`}>
        Motivo (queda registrado)
      </label>
      <input
        id={`motivo-${venta.id}`}
        required
        minLength={3}
        maxLength={300}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="field"
        placeholder="Ej: el cliente devolvió el producto"
      />

      <p className="mt-2 text-sm text-tinta">
        Devolver al cliente:{' '}
        <strong className="font-ticket">{formatearCentavos(aDevolverCentavos)}</strong>
        <span className="ml-1 text-xs text-tinta-suave">(el stock vuelve al inventario)</span>
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="danger" disabled={enviando || aDevolverCentavos === 0}>
          {enviando ? 'Anulando…' : anulaTodo ? 'Anular venta completa' : 'Anular lo seleccionado'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function TarjetaVenta({
  venta,
  puedeAnular,
  anulando,
  onAnular,
  onAnulada,
  onCerrarAnulacion,
}: {
  venta: VentaDelHistorial;
  puedeAnular: boolean;
  anulando: boolean;
  onAnular: () => void;
  onAnulada: (v: VentaDelHistorial) => void;
  onCerrarAnulacion: () => void;
}) {
  const estado = ESTADO[venta.estado];
  const netoCentavos = venta.totalCentavos - venta.totalAnuladoCentavos;

  return (
    // Cada venta como un ticket: una franja con el color de cómo se pagó y
    // el corte perforado entre el encabezado y lo que se llevó.
    <article
      className={`tarjeta-ticket tarjeta-ticket-${venta.metodoPago} flex h-full flex-col ${
        venta.estado === 'anulada' ? 'tarjeta-ticket-anulada' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Ficha nombre={venta.vendedor} redonda />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="ticket-numero">{numeroDeTicket(venta.numero)}</span>
              {estado && <span className={`status-pill ${estado.clase}`}>{estado.texto}</span>}
            </p>
            <p className="truncate text-xs text-tinta-suave">
              {hora(venta.createdAt)} · {venta.vendedor}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="ticket-total">{formatearCentavos(netoCentavos)}</p>
          {venta.totalAnuladoCentavos > 0 && (
            <p className="font-ticket text-xs text-tinta-suave line-through">
              {formatearCentavos(venta.totalCentavos)}
            </p>
          )}
        </div>
      </div>

      <div className="ticket-corte" aria-hidden />

      <ul className="space-y-1.5 text-sm">
        {venta.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-tinta">
              <span className="ticket-cantidad">
                {formatearCantidad(item.cantidad, item.unidad)} ×
              </span>{' '}
              {item.nombre}
              {item.cantidadAnulada > 0 && (
                <span className="ml-1 text-xs text-rojo-perdida">
                  (
                  {item.cantidadAnulada === item.cantidad
                    ? 'anulado'
                    : porPeso(item.unidad)
                      ? `${formatearCantidad(item.cantidadAnulada, item.unidad)} anuladas`
                      : `${item.cantidadAnulada} anulado${item.cantidadAnulada === 1 ? '' : 's'}`}
                  )
                </span>
              )}
            </span>
            <span className="font-ticket text-tinta-suave">
              {formatearCentavos(importeCentavos(item.precioVentaCentavos, item.cantidad))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <ChipMetodoPago
          metodo={venta.metodoPago}
          detalle={
            venta.metodoPago === 'fiado'
              ? (venta.cliente?.nombre ?? 'cliente')
              : venta.metodoPago === 'efectivo'
                ? `recibió ${formatearCentavos(venta.montoRecibidoCentavos)}, vuelto ${formatearCentavos(venta.vueltoCentavos)}`
                : undefined
          }
        />
      </div>

      {venta.anulaciones.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-papel-linea pt-3 text-xs text-tinta-suave">
          {venta.anulaciones.map((a) => (
            <li key={a.id}>
              {hora(a.createdAt)} · {a.anuladoPor} anuló{' '}
              <span className="font-ticket">{formatearCentavos(a.montoDevueltoCentavos)}</span>: “
              {a.motivo}”
            </li>
          ))}
        </ul>
      )}

      {!anulando && (
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {/* En otra pestaña: la lista queda donde estaba. */}
          <a
            href={`/ticket/${venta.id}?imprimir=1`}
            target="_blank"
            rel="noopener"
            className="boton-tarjeta"
          >
            <ReceiptIcon className="h-3.5 w-3.5" />
            Imprimir ticket
          </a>
          {puedeAnular && venta.estado !== 'anulada' && (
            <button
              type="button"
              onClick={onAnular}
              className="boton-tarjeta boton-tarjeta-peligro"
            >
              Anular…
            </button>
          )}
        </div>
      )}

      {anulando && (
        <PanelAnulacion venta={venta} onAnulada={onAnulada} onCerrar={onCerrarAnulacion} />
      )}
    </article>
  );
}

/** Día local de una venta, 'AAAA-MM-DD'. */
function diaDe(venta: VentaDelHistorial): string {
  return fechaISO(new Date(venta.createdAt));
}

/** Agrupa por día manteniendo el orden (de la más reciente a la más vieja). */
function agruparPorDia(
  ventas: VentaDelHistorial[],
): { dia: string; ventas: VentaDelHistorial[] }[] {
  const grupos: { dia: string; ventas: VentaDelHistorial[] }[] = [];
  for (const venta of ventas) {
    const dia = diaDe(venta);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.ventas.push(venta);
    else grupos.push({ dia, ventas: [venta] });
  }
  return grupos;
}

function ContenidoVentas() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [periodoDeLaURL, setPeriodo] = usePeriodoDeLaURL();
  // El cajero ve solo las de hoy (para encontrar una a anular): el
  // historial y los totales de otros días son información del dueño.
  const periodo: Periodo | null = esAdmin ? periodoDeLaURL : periodoDeLaURL && periodoDeHoy();
  const [ventas, setVentas] = useState<VentaDelHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  // Buscar por número de ticket: null = mostrando la lista normal.
  const [numeroBuscado, setNumeroBuscado] = useState('');
  const [encontradas, setEncontradas] = useState<VentaDelHistorial[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscarTicket(e: FormEvent) {
    e.preventDefault();
    const numero = parseInt(numeroBuscado.replace(/\D/g, ''), 10);
    if (!token || !numero) return;
    setBuscando(true);
    setError(null);
    try {
      // El admin busca en todas las fechas; el cajero, entre las de hoy.
      setEncontradas(
        esAdmin
          ? (await buscarVentaPorNumero(token, numero)).ventas
          : ventas.filter((v) => v.numero === numero),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar el ticket');
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    if (!token || !periodo) return;
    // Una respuesta de un período que ya no está elegido no pisa a la nueva.
    let vigente = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(null);
    setAnulandoId(null);
    const pedido: Promise<[PaginaDeVentas, ResumenPeriodo | null]> = esAdmin
      ? Promise.all([listarVentas(token, periodo, POR_PAGINA), obtenerResumen(token, periodo)])
      : obtenerVentasDeHoy(token).then((deHoy) => [{ ventas: deHoy, total: deHoy.length }, null]);
    pedido
      .then(([pagina, resumenResp]) => {
        if (!vigente) return;
        setVentas(pagina.ventas);
        setTotal(pagina.total);
        setResumen(resumenResp);
      })
      .catch((err) => {
        if (vigente)
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // periodo se arma en cada render: se compara por sus fechas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, esAdmin, periodo?.desde, periodo?.hasta, intento]);

  async function cargarMas() {
    if (!token || !periodo) return;
    setCargandoMas(true);
    try {
      const pagina = await listarVentas(token, periodo, POR_PAGINA, ventas.length);
      // Si entró una venta nueva mientras tanto, el corte se corre uno:
      // se evita mostrar dos veces la misma.
      setVentas((previas) => {
        const vistas = new Set(previas.map((v) => v.id));
        return [...previas, ...pagina.ventas.filter((v) => !vistas.has(v.id))];
      });
      setTotal(pagina.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar más ventas');
    } finally {
      setCargandoMas(false);
    }
  }

  function alAnular(actualizada: VentaDelHistorial) {
    setVentas((prev) => prev.map((v) => (v.id === actualizada.id ? actualizada : v)));
    setEncontradas((prev) => prev && prev.map((v) => (v.id === actualizada.id ? actualizada : v)));
    // Los totales de la franja salen del resumen: se vuelven a pedir.
    if (esAdmin && token && periodo)
      obtenerResumen(token, periodo)
        .then(setResumen)
        .catch(() => {});
  }

  const hoy = periodo ? esHoy(periodo) : true;
  const deHoy = hoyISO();
  // Admin: totales del período entero (la lista viene por partes).
  // Cajero: salen de las ventas de hoy, que llegan todas.
  const cobradoCentavos =
    resumen?.ingresoBrutoCentavos ??
    ventas.reduce((acc, v) => acc + v.totalCentavos - v.totalAnuladoCentavos, 0);
  const cantidadCobradas =
    resumen?.cantidadVentas ?? ventas.filter((v) => v.estado !== 'anulada').length;
  const anuladoCentavos =
    resumen?.anuladoCentavos ?? ventas.reduce((acc, v) => acc + v.totalAnuladoCentavos, 0);
  // Lo cobrado según cómo se pagó (el cajero lo saca de las de hoy).
  const netoDe = (metodo: VentaDelHistorial['metodoPago']) =>
    ventas
      .filter((v) => v.metodoPago === metodo)
      .reduce((acc, v) => acc + v.totalCentavos - v.totalAnuladoCentavos, 0);
  const porMetodo = [
    {
      clave: 'efectivo',
      nombre: 'Efectivo',
      centavos: resumen?.efectivoCentavos ?? netoDe('efectivo'),
    },
    {
      clave: 'transferencia',
      nombre: 'Transferencia',
      centavos: resumen?.transferenciaCentavos ?? netoDe('transferencia'),
    },
    { clave: 'fiado', nombre: 'Al fiado', centavos: resumen?.fiadoCentavos ?? netoDe('fiado') },
  ];
  const porDia = new Map(
    resumen?.agrupadoPor === 'dia' ? resumen.serie.map((p) => [p.etiqueta, p.centavos]) : [],
  );
  const grupos = periodo && !hoy && periodo.desde !== periodo.hasta ? agruparPorDia(ventas) : null;

  function tarjeta(venta: VentaDelHistorial) {
    return (
      <div key={venta.id} className={anulandoId === venta.id ? 'lg:col-span-2' : ''}>
        <TarjetaVenta
          venta={venta}
          // Solo el mismo día: una venta de otro día ya está en los números
          // cerrados de ese día.
          puedeAnular={esAdmin && diaDe(venta) === deHoy}
          anulando={anulandoId === venta.id}
          onAnular={() => setAnulandoId(venta.id)}
          onAnulada={alAnular}
          onCerrarAnulacion={() => setAnulandoId(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <Banda
        eyebrow={!periodo || hoy ? 'Caja · hoy' : `Ventas · ${rangoLegible(periodo)}`}
        titulo={!periodo || hoy ? 'Ventas del día' : nombreDelPeriodo(periodo)}
        valor={formatearCentavos(cobradoCentavos)}
        detalle={
          <>
            Cobrado en {cantidadCobradas} venta{cantidadCobradas === 1 ? '' : 's'}.{' '}
            {!esAdmin
              ? 'Si hay que anular una venta, avísale al administrador.'
              : hoy
                ? 'Puedes anular una venta completa o solo algunos productos; el stock vuelve al inventario.'
                : 'Las ventas se pueden anular solo el mismo día en que se hicieron.'}
          </>
        }
        accion={
          <div className="flex items-center gap-2">
            {/* El Excel trae costos y ganancias: solo el admin. */}
            {esAdmin && periodo && <BotonExcel periodo={periodo} />}
            <Button variant="claro" onClick={() => setIntento((n) => n + 1)} disabled={cargando}>
              <RefreshIcon className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        }
        extra={
          <>
            {!cargando && cantidadCobradas + anuladoCentavos > 0 && (
              <div className="banda-datos">
                {porMetodo.map((m) => (
                  <div key={m.clave} className="banda-dato">
                    <span className="banda-dato-etiqueta">
                      <span className={`punto-pago punto-pago-${m.clave}`} aria-hidden />
                      {m.nombre}
                    </span>
                    <span className="banda-dato-valor">{formatearCentavos(m.centavos)}</span>
                  </div>
                ))}
                {anuladoCentavos > 0 && (
                  <div className="banda-dato banda-dato-alerta">
                    <span className="banda-dato-etiqueta">Anulado</span>
                    <span className="banda-dato-valor">{formatearCentavos(anuladoCentavos)}</span>
                  </div>
                )}
              </div>
            )}
            {esAdmin && periodo && (
              <div className="mt-4">
                <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
              </div>
            )}
          </>
        }
      />

      <Hoja>
        <div className="mt-4 space-y-4">
          {esAdmin &&
            resumen &&
            encontradas === null &&
            !cargando &&
            resumen.serie.some((p) => p.centavos > 0) && (
              <div className="pieza pieza-oscura">
                <GraficoIngreso
                  datos={resumen.serie}
                  agrupadoPor={resumen.agrupadoPor}
                  titulo={
                    resumen.agrupadoPor === 'hora' ? 'Ritmo de ventas del día' : 'Ventas por día'
                  }
                  compacto
                />
              </div>
            )}

          <form onSubmit={buscarTicket} className="flex max-w-sm gap-2" role="search">
            <label htmlFor="buscar-ticket" className="sr-only">
              Número de ticket
            </label>
            <input
              id="buscar-ticket"
              inputMode="numeric"
              value={numeroBuscado}
              onChange={(e) => setNumeroBuscado(e.target.value)}
              className="field font-ticket !mb-0 flex-1"
              placeholder={esAdmin ? 'Buscar ticket #, ej: 245' : 'Buscar un ticket de hoy #'}
            />
            <Button type="submit" variant="secondary" disabled={buscando || !numeroBuscado.trim()}>
              Buscar
            </Button>
          </form>

          {encontradas && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-tinta">
                  {encontradas.length === 0
                    ? `No hay ningún ticket #${numeroBuscado.replace(/\D/g, '')}${esAdmin ? '' : ' hoy'}.`
                    : `Ticket ${numeroDeTicket(encontradas[0].numero)}`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEncontradas(null);
                    setNumeroBuscado('');
                  }}
                  className="text-xs font-medium text-tinta underline"
                >
                  Volver a la lista
                </button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">{encontradas.map(tarjeta)}</div>
            </div>
          )}

          {encontradas === null && (
            <>
              {cargando && <LoadingState label="Cargando ventas…" />}

              {error && !cargando && (
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

              {!cargando && !error && ventas.length === 0 && (
                <EmptyState
                  icon={<ReceiptIcon className="h-6 w-6" />}
                  title={hoy ? 'Todavía no hay ventas hoy' : 'No hubo ventas en este período'}
                  description={
                    hoy
                      ? 'Las ventas que se registren en la caja van a aparecer aquí.'
                      : 'Prueba con otras fechas.'
                  }
                />
              )}

              {/* Dos columnas en pantallas anchas: cada venta tiene poco
              contenido y a todo el ancho quedaba una lista muy aireada.
              La que se está anulando ocupa el ancho completo, porque el
              panel de anulación necesita espacio. */}
              {!cargando && !error && !grupos && (
                <div className="grid gap-4 lg:grid-cols-2">{ventas.map(tarjeta)}</div>
              )}

              {/* Varios días: cada uno con su título y lo cobrado ese día. */}
              {!cargando &&
                !error &&
                grupos?.map((grupo) => (
                  <section key={grupo.dia} aria-label={fechaLarga(grupo.dia)} className="pt-2">
                    <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 border-b border-papel-linea pb-2">
                      <span className="font-display text-base font-semibold capitalize text-tinta">
                        {grupo.dia === deHoy ? 'Hoy' : fechaLarga(grupo.dia)}
                      </span>
                      {porDia.has(grupo.dia) && (
                        <span className="font-ticket text-sm text-tinta-suave">
                          {formatearCentavos(porDia.get(grupo.dia)!)} cobrado
                        </span>
                      )}
                    </h2>
                    <div className="grid gap-4 lg:grid-cols-2">{grupo.ventas.map(tarjeta)}</div>
                  </section>
                ))}

              {!cargando && !error && ventas.length < total && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="text-xs text-tinta-suave">
                    Mostrando {ventas.length} de {total} ventas
                  </p>
                  <Button variant="secondary" onClick={cargarMas} disabled={cargandoMas}>
                    {cargandoMas
                      ? 'Cargando…'
                      : `Ver ${Math.min(POR_PAGINA, total - ventas.length)} más`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Hoja>
    </div>
  );
}

export default function VentasPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoVentas />
    </RutaProtegida>
  );
}
