'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState, SectionHeader } from '@/components/ui';
import { Banda, Hoja, Pieza } from '@/components/banda';
import { CartIcon, CashIcon, MinusIcon, ReceiptIcon } from '@/components/icons';
import { Ventana } from '@/components/ventana';
import {
  FormularioAbrirCaja,
  FormularioCierre,
  FormularioMovimiento,
  ListaMovimientos,
  ResultadoArqueo,
} from '@/components/caja';
import { useAuth } from '@/lib/auth-context';
import { listarTurnosCaja, obtenerCajaActual, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import { horaDe, textoDiferencia, tonoDiferencia } from '@/lib/caja';
import { fechaLarga, fechaISO, periodoPredefinido } from '@/lib/periodo';
import type { TurnoCaja } from '@/lib/tipos';

// --- Cajas del equipo (admin) ---

const PERIODOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'semana', texto: '7 días' },
  { clave: 'mes', texto: 'Este mes' },
] as const;

const PILL_DIFERENCIA = {
  ok: 'status-pill-ok',
  falta: 'status-pill-danger',
  sobra: 'status-pill-warning',
} as const;

function TarjetaTurno({
  turno,
  propio,
  onCambio,
}: {
  turno: TurnoCaja;
  propio: boolean;
  onCambio: () => void;
}) {
  const [viendo, setViendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const fecha = fechaLarga(fechaISO(new Date(turno.abiertoEn)));
  // Solo la primera letra: `capitalize` de CSS ponía "23 De Septiembre".
  const dia = fecha[0].toUpperCase() + fecha.slice(1);

  return (
    <li className="app-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-tinta">{turno.cajero}</p>
          <p className="text-xs text-tinta-suave">
            {dia} · {horaDe(turno.abiertoEn)}
            {turno.cerradoEn ? ` a ${horaDe(turno.cerradoEn)}` : ' · abierta'}
          </p>
        </div>
        {turno.diferenciaCentavos !== undefined ? (
          <span
            className={`status-pill font-ticket text-xs ${PILL_DIFERENCIA[tonoDiferencia(turno.diferenciaCentavos)]}`}
          >
            {textoDiferencia(turno.diferenciaCentavos)}
          </span>
        ) : (
          <span className="status-pill status-pill-neutral text-xs">Abierta</span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-tinta-suave">Ventas</dt>
          <dd className="font-ticket text-sm text-tinta">{turno.cantidadVentas}</dd>
        </div>
        <div>
          <dt className="text-tinta-suave">
            {turno.estado === 'abierto' ? 'Debería haber' : 'Debía haber'}
          </dt>
          <dd className="font-ticket text-sm text-tinta">
            {formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-tinta-suave">Transferencias</dt>
          <dd className="font-ticket text-sm text-tinta">
            {formatearCentavos(turno.ventasTransferenciaCentavos)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViendo(true)}
          className="inline-flex items-center gap-1 rounded-full bg-tinta/5 px-2.5 py-1 text-xs font-medium text-tinta transition-colors hover:bg-tinta/10"
        >
          <ReceiptIcon className="h-3 w-3" />
          Ver el detalle
        </button>
        {turno.estado === 'abierto' && !propio && (
          <button
            type="button"
            onClick={() => setCerrando(true)}
            className="inline-flex items-center gap-1 rounded-full bg-tinta/5 px-2.5 py-1 text-xs font-medium text-tinta transition-colors hover:bg-tinta/10"
          >
            <CashIcon className="h-3 w-3" />
            Cerrar esta caja
          </button>
        )}
      </div>

      {viendo && (
        <Ventana
          titulo={`Caja de ${turno.cajero}`}
          descripcion={`${dia} · ${horaDe(turno.abiertoEn)}${
            turno.cerradoEn ? ` a ${horaDe(turno.cerradoEn)}` : ' · abierta'
          }`}
          icono={<ReceiptIcon className="h-5 w-5" />}
          onCerrar={() => setViendo(false)}
        >
          <div className="space-y-4 pb-5">
            <ResultadoArqueo turno={turno} />
            <ListaMovimientos movimientos={turno.movimientos} />
          </div>
        </Ventana>
      )}

      {cerrando && (
        <Ventana
          titulo={`Cerrar la caja de ${turno.cajero}`}
          descripcion="Cuenta todo el efectivo del cajón, incluido el cambio con el que abrió."
          icono={<CashIcon className="h-5 w-5" />}
          onCerrar={() => setCerrando(false)}
        >
          <FormularioCierre turnoId={turno.id} onCerrado={onCambio} />
        </Ventana>
      )}
    </li>
  );
}

function CajasDelEquipo({ usuarioId, version }: { usuarioId: string; version: number }) {
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['clave']>('semana');
  const [turnos, setTurnos] = useState<TurnoCaja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    listarTurnosCaja(token, periodoPredefinido(periodo))
      .then((t) => vigente && setTurnos(t))
      .catch(
        (err) =>
          vigente &&
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las cajas'),
      );
    return () => {
      vigente = false;
    };
  }, [token, periodo, version, recarga]);

  const cerrados = turnos?.filter((t) => t.diferenciaCentavos !== undefined) ?? [];
  const neto = cerrados.reduce((acc, t) => acc + t.diferenciaCentavos!, 0);

  return (
    <section>
      <SectionHeader
        title="Cajas del equipo"
        description="Cada turno con lo que debía haber y lo que se contó al cerrar."
      />
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p.clave}
            type="button"
            aria-pressed={periodo === p.clave}
            onClick={() => setPeriodo(p.clave)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              periodo === p.clave
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white text-tinta'
            }`}
          >
            {p.texto}
          </button>
        ))}
        {cerrados.length > 0 && (
          <span className="ml-auto text-xs text-tinta-suave">
            {cerrados.filter((t) => t.diferenciaCentavos !== 0).length} de {cerrados.length} cierres
            con diferencia · en total {textoDiferencia(neto).toLowerCase()}
          </span>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-rojo-perdida">{error}</p>}
      {!turnos && !error && <LoadingState label="Cargando cajas…" />}
      {turnos?.length === 0 && (
        <p className="mt-4 text-sm text-tinta-suave">No hubo cajas abiertas en este período.</p>
      )}
      {turnos && turnos.length > 0 && (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {turnos.map((t) => (
            <TarjetaTurno
              key={t.id}
              turno={t}
              propio={t.usuarioId === usuarioId}
              onCambio={() => setRecarga((n) => n + 1)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Mi caja ---

function ContenidoCaja() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [cierre, setCierre] = useState<TurnoCaja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<'movimiento' | 'cerrar' | null>(null);
  // Para que la lista del equipo se actualice cuando cambia mi caja.
  const [version, setVersion] = useState(0);

  function cargar() {
    if (!token) return;
    setError(null);
    obtenerCajaActual(token)
      .then(setTurno)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la caja'),
      );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function actualizar(t: TurnoCaja) {
    setTurno(t);
    setVersion((v) => v + 1);
  }

  const abierta = turno?.estado === 'abierto';

  return (
    <div>
      <Banda
        eyebrow={abierta ? `Abierta a las ${horaDe(turno!.abiertoEn)}` : 'Arqueo'}
        titulo="Caja"
        valor={
          abierta
            ? esAdmin
              ? formatearCentavos(turno!.efectivoEsperadoCentavos ?? 0)
              : `${turno!.cantidadVentas} venta${turno!.cantidadVentas === 1 ? '' : 's'}`
            : cierre
              ? textoDiferencia(cierre.diferenciaCentavos ?? 0)
              : turno === null
                ? 'Cerrada'
                : undefined
        }
        detalle={
          abierta
            ? esAdmin
              ? `Efectivo que debería haber en el cajón · empezaste con ${formatearCentavos(turno!.fondoInicialCentavos)}.`
              : `Empezaste con ${formatearCentavos(turno!.fondoInicialCentavos)} de cambio. Lo que debería haber lo ves al cerrar, después de contar.`
            : cierre
              ? 'Caja cerrada. Abre otra cuando vuelvas a vender.'
              : 'Abre la caja con el cambio del cajón para empezar a vender.'
        }
        accion={
          abierta && (
            <Link href="/venta" className="button button-claro">
              <CartIcon className="h-4 w-4" />
              Vender
            </Link>
          )
        }
      />

      <Hoja>
        <div className="mt-4 space-y-8">
          {error && (
            <ErrorState
              action={
                <Button variant="secondary" onClick={cargar}>
                  Reintentar
                </Button>
              }
            >
              {error}
            </ErrorState>
          )}
          {turno === undefined && !error && <LoadingState label="Cargando caja…" />}

          {cierre && (
            <div className="app-card mx-auto max-w-md p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-tinta">Resultado del cierre</h2>
              <div className="mt-3">
                <ResultadoArqueo turno={cierre} />
              </div>
            </div>
          )}

          {turno === null && (
            <FormularioAbrirCaja
              onAbierta={(t) => {
                setCierre(null);
                actualizar(t);
              }}
            />
          )}

          {abierta && (
            <>
              <div className="mosaico">
                <Pieza
                  etiqueta="Cambio inicial"
                  valor={formatearCentavos(turno!.fondoInicialCentavos)}
                  detalle={`Desde las ${horaDe(turno!.abiertoEn)}`}
                />
                <Pieza
                  etiqueta="Ventas"
                  valor={String(turno!.cantidadVentas)}
                  detalle={
                    esAdmin
                      ? `${formatearCentavos(turno!.ventasEfectivoCentavos ?? 0)} en efectivo`
                      : 'Cobradas en esta caja'
                  }
                />
                <Pieza
                  etiqueta="Transferencias"
                  valor={formatearCentavos(turno!.ventasTransferenciaCentavos)}
                  detalle="No entran al cajón"
                />
                <Pieza
                  etiqueta="Efectivo sacado"
                  valor={formatearCentavos(turno!.retirosCentavos)}
                  tono={turno!.retirosCentavos > 0 ? 'rojo' : 'neutro'}
                  detalle={
                    turno!.ingresosCentavos > 0
                      ? `${formatearCentavos(turno!.ingresosCentavos)} puesto`
                      : 'Pagos, depósitos'
                  }
                />
              </div>

              <section className="app-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-tinta">
                    Movimientos de efectivo
                  </h2>
                  <Button variant="secondary" onClick={() => setAccion('movimiento')}>
                    Sacar o poner efectivo
                  </Button>
                </div>
                {turno!.movimientos.length === 0 && (
                  <p className="mt-2 text-sm text-tinta-suave">
                    Si pagas algo con dinero del cajón o traes más cambio, regístralo aquí para que la
                    caja cuadre.
                  </p>
                )}
                <div className="mt-2">
                  <ListaMovimientos movimientos={turno!.movimientos} />
                </div>
              </section>

              <div className="flex justify-center">
                <Button variant="primary" onClick={() => setAccion('cerrar')}>
                  Cerrar la caja
                </Button>
              </div>
            </>
          )}

          {/* Afuera del bloque de la caja abierta: al cerrarla, la ventana
              se va con su animación aunque la caja ya no esté abierta. */}
          {accion === 'movimiento' && (
            <Ventana
              titulo="Sacar o poner efectivo"
              descripcion="Queda registrado y se tiene en cuenta al cerrar la caja."
              icono={<CashIcon className="h-5 w-5" />}
              onCerrar={() => setAccion(null)}
            >
              <FormularioMovimiento onRegistrado={actualizar} />
            </Ventana>
          )}

          {accion === 'cerrar' && (
            <Ventana
              titulo="Cerrar la caja"
              descripcion="Cuenta todo el efectivo del cajón, incluido el cambio con el que abriste. Después de cerrar vas a ver si cuadra."
              icono={<MinusIcon className="h-5 w-5" />}
              onCerrar={() => setAccion(null)}
            >
              <FormularioCierre
                onCerrado={(t) => {
                  setCierre(t);
                  setTurno(null);
                  setVersion((v) => v + 1);
                }}
              />
            </Ventana>
          )}

          {esAdmin && usuario && <CajasDelEquipo usuarioId={usuario.sub} version={version} />}
        </div>
      </Hoja>
    </div>
  );
}

export default function CajaPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoCaja />
    </RutaProtegida>
  );
}
