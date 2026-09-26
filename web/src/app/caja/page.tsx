'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState, SectionHeader } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { Ficha } from '@/components/ficha';
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
import { useSinConexion } from '@/lib/sin-conexion';
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
    <li
      className={`app-card tarjeta-turno tarjeta-turno-${
        turno.diferenciaCentavos === undefined
          ? 'abierta'
          : tonoDiferencia(turno.diferenciaCentavos)
      } p-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Ficha nombre={turno.cajero} tamano="chica" redonda />
          <div className="min-w-0">
            <p className="font-medium text-tinta">{turno.cajero}</p>
            <p className="text-xs text-tinta-suave">
              {dia} · {horaDe(turno.abiertoEn)}
              {turno.cerradoEn ? ` a ${horaDe(turno.cerradoEn)}` : ' · abierta'}
            </p>
          </div>
        </div>
        {turno.diferenciaCentavos !== undefined ? (
          <span
            className={`status-pill font-ticket text-xs ${PILL_DIFERENCIA[tonoDiferencia(turno.diferenciaCentavos)]}`}
          >
            {textoDiferencia(turno.diferenciaCentavos)}
          </span>
        ) : (
          <span className="status-pill status-pill-abierta text-xs">
            <span className="punto-vivo" aria-hidden />
            Abierta
          </span>
        )}
      </div>

      <dl className="datos-turno mt-3">
        <div>
          <dt>Ventas</dt>
          <dd>{turno.cantidadVentas}</dd>
        </div>
        <div>
          <dt>{turno.estado === 'abierto' ? 'Hay en el cajón' : 'Tenía que haber'}</dt>
          <dd>{formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}</dd>
        </div>
        {turno.efectivoContadoCentavos !== undefined ? (
          <div>
            <dt>Se contó</dt>
            <dd>{formatearCentavos(turno.efectivoContadoCentavos)}</dd>
          </div>
        ) : (
          <div>
            <dt>Transferencias</dt>
            <dd>{formatearCentavos(turno.ventasTransferenciaCentavos)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setViendo(true)} className="boton-tarjeta">
          <ReceiptIcon className="h-3.5 w-3.5" />
          Ver el detalle
        </button>
        {turno.estado === 'abierto' && !propio && (
          <button type="button" onClick={() => setCerrando(true)} className="boton-tarjeta">
            <CashIcon className="h-3.5 w-3.5" />
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

/**
 * De dónde sale lo que tiene que haber en el cajón, como una suma:
 * cambio inicial + ventas en efectivo + lo puesto − lo sacado. Lo que se
 * cobró por transferencia o al fiado va aparte: no entra al cajón.
 *
 * El cajero no ve las ventas en efectivo ni el total (conteo a ciegas:
 * lo ve al cerrar, después de contar).
 */
function CuentaDelCajon({ turno }: { turno: TurnoCaja }) {
  const ciega = turno.efectivoEsperadoCentavos === undefined;
  const pasos: { signo: string; etiqueta: string; valor: string; nota: string }[] = [
    {
      signo: '',
      etiqueta: 'Cambio inicial',
      valor: formatearCentavos(turno.fondoInicialCentavos),
      nota: `Desde las ${horaDe(turno.abiertoEn)}`,
    },
    {
      signo: '+',
      etiqueta: 'Ventas en efectivo',
      valor: ciega
        ? `${turno.cantidadVentas} venta${turno.cantidadVentas === 1 ? '' : 's'}`
        : formatearCentavos(turno.ventasEfectivoCentavos ?? 0),
      nota: ciega
        ? 'El monto lo ves al cerrar'
        : `${turno.cantidadVentas} venta${turno.cantidadVentas === 1 ? '' : 's'} en total`,
    },
    {
      signo: '+',
      etiqueta: 'Puesto',
      valor: formatearCentavos(turno.ingresosCentavos),
      nota: 'Cambio que trajiste',
    },
    {
      signo: '−',
      etiqueta: 'Sacado',
      valor: formatearCentavos(turno.retirosCentavos),
      nota: 'Pagos, depósitos',
    },
  ];
  return (
    <section className="app-card p-4 sm:p-5" aria-label="Cuenta del cajón">
      <div className="cuenta-cajon">
        {pasos.map((paso) => (
          <div key={paso.etiqueta} className="cuenta-paso">
            {paso.signo && (
              <span className="cuenta-signo" aria-hidden>
                {paso.signo}
              </span>
            )}
            <div>
              <p className="cuenta-etiqueta">{paso.etiqueta}</p>
              <p className="cuenta-valor">{paso.valor}</p>
              <p className="cuenta-nota">{paso.nota}</p>
            </div>
          </div>
        ))}
        <div className="cuenta-paso cuenta-total">
          <span className="cuenta-signo" aria-hidden>
            =
          </span>
          <div>
            <p className="cuenta-etiqueta">En el cajón</p>
            <p className="cuenta-valor">
              {ciega ? '¿?' : formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}
            </p>
            <p className="cuenta-nota">
              {ciega ? 'Se ve al cerrar la caja' : 'Lo que hay que contar'}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-papel-linea pt-3 text-xs text-tinta-suave">
        <span className="font-medium">No entran al cajón:</span>
        <span className="chip-pago chip-pago-transferencia">
          Transferencias {formatearCentavos(turno.ventasTransferenciaCentavos)}
        </span>
        <span className="chip-pago chip-pago-fiado">
          Al fiado {formatearCentavos(turno.ventasFiadoCentavos)}
        </span>
      </div>
    </section>
  );
}

function ContenidoCaja() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  // Las ventas cobradas sin conexión son de esta caja: hasta que lleguen,
  // cerrarla dejaría el arqueo corto.
  const { pendientes, recordarCaja } = useSinConexion();
  const sinEnviar = pendientes.length;
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
      .then((t) => {
        setTurno(t);
        recordarCaja(t);
      })
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
    recordarCaja(t);
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
              ? `Efectivo que debería haber en el cajón ahora. Abajo, de dónde sale.`
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
              <CuentaDelCajon turno={turno!} />

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
                    Si pagas algo con dinero del cajón o traes más cambio, regístralo aquí para que
                    la caja cuadre.
                  </p>
                )}
                <div className="mt-2">
                  <ListaMovimientos movimientos={turno!.movimientos} />
                </div>
              </section>

              <div className="flex flex-col items-center gap-2">
                {sinEnviar > 0 && (
                  <p className="max-w-md text-center text-sm text-tinta-suave">
                    {`Antes de cerrar hay que enviar ${sinEnviar === 1 ? 'la venta cobrada' : `las ${sinEnviar} ventas cobradas`} sin conexión (se envían solas al volver internet; las que tengan problema, revísalas en Vender).`}
                  </p>
                )}
                <Button
                  variant="primary"
                  onClick={() => setAccion('cerrar')}
                  disabled={sinEnviar > 0}
                >
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
                  recordarCaja(null);
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
