'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { ReceiptIcon, RefreshIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { obtenerVentasDeHoy, anularVenta, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { VentaDelHistorial } from '@/lib/tipos';

const ESTADO: Record<VentaDelHistorial['estado'], { texto: string; clase: string }> = {
  completa: { texto: 'Completa', clase: 'status-pill-ok' },
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
    .map((item) => ({ ...item, pendiente: item.cantidad - item.cantidadAnulada }))
    .filter((item) => item.pendiente > 0);
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(pendientes.map((item) => [item.id, item.pendiente])),
  );
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aDevolverCentavos = pendientes.reduce(
    (acc, item) => acc + item.precioVentaCentavos * (cantidades[item.id] ?? 0),
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
              <span className="ml-1 text-xs text-tinta-suave">(de {item.pendiente})</span>
            </label>
            <input
              id={`anular-${item.id}`}
              type="number"
              min={0}
              max={item.pendiente}
              value={cantidades[item.id] ?? 0}
              onChange={(e) => {
                const valor = Math.max(0, Math.min(item.pendiente, parseInt(e.target.value, 10) || 0));
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
        Devolver al cliente: <strong className="font-ticket">{formatearCentavos(aDevolverCentavos)}</strong>
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
    <div className="app-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-ticket text-sm text-tinta">
            {hora(venta.createdAt)} · <span className="text-tinta-suave">{venta.vendedor}</span>
          </p>
          <span className={`status-pill ${estado.clase} mt-1 text-xs`}>{estado.texto}</span>
        </div>
        <div className="text-right">
          <p className="font-ticket text-lg font-semibold text-tinta">
            {formatearCentavos(netoCentavos)}
          </p>
          {venta.totalAnuladoCentavos > 0 && (
            <p className="font-ticket text-xs text-tinta-suave line-through">
              {formatearCentavos(venta.totalCentavos)}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {venta.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="text-tinta">
              {item.cantidad} × {item.nombre}
              {item.cantidadAnulada > 0 && (
                <span className="ml-1 text-xs text-rojo-perdida">
                  ({item.cantidadAnulada === item.cantidad ? 'anulado' : `${item.cantidadAnulada} anulado${item.cantidadAnulada === 1 ? '' : 's'}`})
                </span>
              )}
            </span>
            <span className="font-ticket text-tinta-suave">
              {formatearCentavos(item.precioVentaCentavos * item.cantidad)}
            </span>
          </li>
        ))}
      </ul>

      {venta.anulaciones.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-papel-linea pt-3 text-xs text-tinta-suave">
          {venta.anulaciones.map((a) => (
            <li key={a.id}>
              {hora(a.createdAt)} · {a.anuladoPor} anuló{' '}
              <span className="font-ticket">{formatearCentavos(a.montoDevueltoCentavos)}</span>: “{a.motivo}”
            </li>
          ))}
        </ul>
      )}

      {puedeAnular && venta.estado !== 'anulada' && !anulando && (
        <button
          type="button"
          onClick={onAnular}
          className="mt-3 text-xs font-medium text-rojo-perdida underline"
        >
          Anular…
        </button>
      )}

      {anulando && (
        <PanelAnulacion venta={venta} onAnulada={onAnulada} onCerrar={onCerrarAnulacion} />
      )}
    </div>
  );
}

function ContenidoVentas() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [ventas, setVentas] = useState<VentaDelHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  function cargar() {
    if (!token) return;
    setCargando(true);
    setError(null);
    obtenerVentasDeHoy(token)
      .then(setVentas)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas'),
      )
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="app-page">
      <div className="app-container">
        <PageHeader
          eyebrow="Caja"
          title="Ventas de hoy"
          description={
            esAdmin
              ? 'Todas las ventas del día. Podés anular una venta completa o solo algunos productos; el stock vuelve al inventario.'
              : 'Todas las ventas del día. Si hay que anular una, avisale al administrador.'
          }
          action={
            <Button variant="secondary" onClick={cargar} disabled={cargando}>
              <RefreshIcon className="h-4 w-4" />
              Actualizar
            </Button>
          }
        />

        <div className="mt-8 space-y-4">
          {cargando && <LoadingState label="Cargando ventas…" />}

          {error && !cargando && (
            <ErrorState action={<Button variant="secondary" onClick={cargar}>Reintentar</Button>}>
              {error}
            </ErrorState>
          )}

          {!cargando && !error && ventas.length === 0 && (
            <EmptyState
              icon={<ReceiptIcon className="h-6 w-6" />}
              title="Todavía no hay ventas hoy"
              description="Las ventas que se registren en la caja van a aparecer acá."
            />
          )}

          {!cargando &&
            !error &&
            ventas.map((venta) => (
              <TarjetaVenta
                key={venta.id}
                venta={venta}
                puedeAnular={esAdmin}
                anulando={anulandoId === venta.id}
                onAnular={() => setAnulandoId(venta.id)}
                onAnulada={(actualizada) =>
                  setVentas((prev) => prev.map((v) => (v.id === actualizada.id ? actualizada : v)))
                }
                onCerrarAnulacion={() => setAnulandoId(null)}
              />
            ))}
        </div>
      </div>
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
