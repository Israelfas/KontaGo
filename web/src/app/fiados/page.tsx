'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { NotebookIcon, PlusIcon } from '@/components/icons';
import { Ventana, VentanaPie, useVentana } from '@/components/ventana';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  abonarCliente,
  actualizarCliente,
  crearCliente,
  listarClientes,
  obtenerCliente,
} from '@/lib/api';
import { formatearCentavos, numeroDeTicket } from '@/lib/formato';
import { formatearCantidad } from '@/lib/cantidad';
import { normalizar } from '@/lib/filtro-productos';
import { enlaceWhatsApp, fechaYHora, textoDelSaldo } from '@/lib/fiado';
import type {
  ClienteFiado,
  DetalleClienteFiado,
  MetodoDeAbono,
  MovimientoDeFiado,
} from '@/lib/tipos';

function FormularioNuevoCliente({ onCreado }: { onCreado: () => void }) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await crearCliente(token, { nombre, telefono: telefono.trim() || undefined });
      onCreado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anotar el cliente');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      <label className="field-label" htmlFor="cliente-nombre">
        Nombre
      </label>
      <input
        id="cliente-nombre"
        required
        minLength={2}
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="field"
        placeholder="Doña Rosa"
      />
      <label className="field-label" htmlFor="cliente-telefono">
        Celular (opcional)
      </label>
      <input
        id="cliente-telefono"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        className="field font-ticket"
        placeholder="099 123 4567"
      />
      <p className="-mt-2 text-xs text-tinta-suave">
        Para recordarle por WhatsApp lo que debe, con un toque.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Anotando…' : 'Anotar cliente'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

/** Registrar un abono: todo lo que debe, o una parte. */
function FormularioAbono({
  cliente,
  onAbonado,
}: {
  cliente: DetalleClienteFiado;
  onAbonado: () => void;
}) {
  const { token } = useAuth();
  const [monto, setMonto] = useState((cliente.saldoCentavos / 100).toFixed(2));
  const [metodo, setMetodo] = useState<MetodoDeAbono>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const centavos = Math.round(parseFloat(monto.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setError('Pon cuánto paga.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await abonarCliente(token, cliente.id, { montoCentavos: centavos, metodoPago: metodo });
      onAbonado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abono');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="rounded-xl bg-papel p-4">
      <p className="text-sm font-semibold text-tinta">Registrar un abono</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="abono-monto">
            Cuánto paga
          </label>
          <input
            id="abono-monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="field font-ticket !mb-0"
          />
        </div>
        <div>
          <p className="field-label" id="abono-metodo">
            Cómo
          </p>
          <div
            role="radiogroup"
            aria-labelledby="abono-metodo"
            className="grid grid-cols-2 gap-1.5"
          >
            {(
              [
                ['efectivo', 'Efectivo'],
                ['transferencia', 'Transf.'],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={metodo === valor}
                onClick={() => setMetodo(valor)}
                className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                  metodo === valor
                    ? 'border-tinta bg-tinta text-papel'
                    : 'border-papel-linea bg-white text-tinta hover:border-tinta'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        {metodo === 'efectivo'
          ? 'Entra a tu caja (tiene que estar abierta).'
          : 'Confirma en el celular que llegó la transferencia.'}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
      <Button type="submit" variant="success" disabled={enviando} className="mt-3 w-full">
        {enviando ? 'Registrando…' : 'Registrar abono'}
      </Button>
    </form>
  );
}

function FilaMovimiento({ movimiento }: { movimiento: MovimientoDeFiado }) {
  if (movimiento.tipo === 'abono') {
    return (
      <li className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm text-tinta">
            Abono en {movimiento.metodoPago === 'efectivo' ? 'efectivo' : 'transferencia'}
          </p>
          <p className="text-xs text-tinta-suave">
            {fechaYHora(movimiento.fecha)} · recibió {movimiento.registradoPor}
          </p>
        </div>
        <span className="shrink-0 font-ticket text-sm font-semibold text-verde-ganancia">
          −{formatearCentavos(movimiento.montoCentavos)}
        </span>
      </li>
    );
  }
  const neto = movimiento.totalCentavos - movimiento.anuladoCentavos;
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-tinta">
          Ticket {numeroDeTicket(movimiento.numero)}
          {movimiento.anuladoCentavos > 0 && (
            <span className="ml-1 text-xs text-rojo-perdida">
              ({neto === 0 ? 'anulado' : `anulado ${formatearCentavos(movimiento.anuladoCentavos)}`}
              )
            </span>
          )}
        </p>
        <p className="truncate text-xs text-tinta-suave">
          {fechaYHora(movimiento.fecha)} ·{' '}
          {movimiento.items
            .map((i) => `${formatearCantidad(i.cantidad, i.unidad)} ${i.nombre}`)
            .join(', ')}
        </p>
      </div>
      <span className="shrink-0 font-ticket text-sm font-semibold text-tinta">
        +{formatearCentavos(neto)}
      </span>
    </li>
  );
}

function DetalleCliente({ clienteId, onCambio }: { clienteId: string; onCambio: () => void }) {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const { cerrar } = useVentana();
  const [cliente, setCliente] = useState<DetalleClienteFiado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function cargar() {
    if (!token) return;
    obtenerCliente(token, clienteId)
      .then(setCliente)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el cliente'),
      );
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, clienteId]);

  async function archivar() {
    if (!token || !cliente) return;
    try {
      await actualizarCliente(token, cliente.id, { activo: false });
      onCambio();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo archivar');
    }
  }

  if (error) return <ErrorState>{error}</ErrorState>;
  if (!cliente) return <LoadingState label="Cargando su cuenta…" />;

  const whatsapp =
    cliente.telefono && cliente.saldoCentavos > 0
      ? enlaceWhatsApp(
          cliente.telefono,
          `Hola ${cliente.nombre}, te saludamos de la tienda. Tu cuenta del fiado está en ${formatearCentavos(cliente.saldoCentavos)}. ¡Gracias!`,
        )
      : null;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            {cliente.saldoCentavos > 0 ? 'Debe' : cliente.saldoCentavos < 0 ? 'A favor' : 'Al día'}
          </p>
          <p className="font-ticket text-3xl font-semibold text-tinta">
            {formatearCentavos(Math.abs(cliente.saldoCentavos))}
          </p>
          {cliente.telefono && (
            <p className="font-ticket text-xs text-tinta-suave">{cliente.telefono}</p>
          )}
        </div>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary shrink-0"
          >
            Recordarle por WhatsApp
          </a>
        )}
      </div>

      {aviso && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-verde-ganancia/10 px-3 py-2 text-sm text-verde-ganancia"
        >
          {aviso}
        </p>
      )}

      {cliente.saldoCentavos > 0 && (
        <div className="mt-4">
          <FormularioAbono
            // Tras un abono, el monto sugerido pasa a ser el nuevo saldo.
            key={cliente.saldoCentavos}
            cliente={cliente}
            onAbonado={() => {
              setAviso('Abono registrado.');
              cargar();
              onCambio();
            }}
          />
        </div>
      )}

      <p className="field-label mt-5">Movimientos</p>
      {cliente.movimientos.length === 0 ? (
        <p className="text-sm text-tinta-suave">Todavía no tiene compras al fiado.</p>
      ) : (
        <ul className="divide-y divide-papel-linea">
          {cliente.movimientos.map((m) => (
            <FilaMovimiento key={`${m.tipo}-${m.id}`} movimiento={m} />
          ))}
        </ul>
      )}

      {esAdmin && cliente.saldoCentavos === 0 && (
        <button
          type="button"
          onClick={archivar}
          className="mt-4 text-xs font-medium text-tinta-suave underline hover:text-tinta"
        >
          Archivar (ya no se le fía)
        </button>
      )}
    </div>
  );
}

function ContenidoFiados() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteFiado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<ClienteFiado | null>(null);
  const [creando, setCreando] = useState(false);

  function cargar() {
    if (!token) return;
    setError(null);
    listarClientes(token)
      .then(setClientes)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el fiado'),
      );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const deudores = (clientes ?? []).filter((c) => c.saldoCentavos > 0);
  const porCobrar = deudores.reduce((acc, c) => acc + c.saldoCentavos, 0);
  const q = normalizar(busqueda);
  const visibles = (clientes ?? []).filter((c) => !q || normalizar(c.nombre).includes(q));

  return (
    <div>
      <Banda
        eyebrow="Fiados"
        titulo="Por cobrar"
        valor={clientes ? formatearCentavos(porCobrar) : undefined}
        detalle={
          clientes
            ? deudores.length === 0
              ? 'Nadie debe nada.'
              : `${deudores.length} cliente${deudores.length === 1 ? '' : 's'} con deuda`
            : undefined
        }
        accion={
          <Button variant="claro" onClick={() => setCreando(true)}>
            <PlusIcon className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />
      <Hoja>
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
        {!clientes && !error && <LoadingState label="Cargando el fiado…" />}
        {clientes && clientes.length === 0 && (
          <EmptyState
            icon={<NotebookIcon className="h-6 w-6" />}
            title="Todavía no le fías a nadie"
            description="Al vender, elige Fiado y anota al cliente: aquí vas a ver cuánto debe cada uno y sus abonos."
          />
        )}
        {clientes && clientes.length > 0 && (
          <>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="field"
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
            />
            <ul className="space-y-2">
              {visibles.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setAbierto(c)}
                    className="app-card flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:border-tinta"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-tinta">
                        {c.nombre}
                      </span>
                      <span className="block text-xs text-tinta-suave">
                        {c.ultimoMovimiento
                          ? `Último movimiento: ${fechaYHora(c.ultimoMovimiento)}`
                          : 'Sin movimientos todavía'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-ticket text-sm font-semibold ${
                        c.saldoCentavos > 0 ? 'text-rojo-perdida' : 'text-tinta-suave'
                      }`}
                    >
                      {textoDelSaldo(c.saldoCentavos)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Hoja>

      {creando && (
        <Ventana
          titulo="Nuevo cliente"
          descripcion="Alguien de confianza a quien le fías."
          onCerrar={() => setCreando(false)}
        >
          <FormularioNuevoCliente onCreado={cargar} />
        </Ventana>
      )}
      {abierto && (
        <Ventana titulo={abierto.nombre} onCerrar={() => setAbierto(null)}>
          <DetalleCliente clienteId={abierto.id} onCambio={cargar} />
        </Ventana>
      )}
    </div>
  );
}

export default function FiadosPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoFiados />
    </RutaProtegida>
  );
}
