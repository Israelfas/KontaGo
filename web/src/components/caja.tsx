'use client';

import { useState, type FormEvent } from 'react';
import { AvisoDeCampo, Button } from '@/components/ui';
import { VentanaPie, useVentana } from '@/components/ventana';
import { useAuth } from '@/lib/auth-context';
import { abrirCaja, cerrarCaja, registrarMovimientoCaja, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import { aCentavos, problemaDelLargo } from '@/lib/validacion';
import {
  DENOMINACIONES,
  FONDOS_RAPIDOS,
  horaDe,
  textoDiferencia,
  tonoDiferencia,
  totalDelConteo,
} from '@/lib/caja';
import type { MovimientoCaja, TipoMovimientoCaja, TurnoCaja } from '@/lib/tipos';

function MensajeError({ children }: { children: string }) {
  return (
    <p
      className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida"
      role="alert"
    >
      {children}
    </p>
  );
}

// --- Abrir ---

export function FormularioAbrirCaja({ onAbierta }: { onAbierta: (t: TurnoCaja) => void }) {
  const { token } = useAuth();
  const [fondo, setFondo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fondoCentavos = aCentavos(fondo);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    if (!token || fondoCentavos === null) return;
    setEnviando(true);
    setError(null);
    try {
      onAbierta(await abrirCaja(token, fondoCentavos));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir la caja');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={abrir} className="app-card mx-auto max-w-md p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-tinta">Abrir la caja</h2>
      <p className="mt-1 text-sm text-tinta-suave">
        Cuenta el cambio que hay en el cajón antes de empezar. Al cerrar, se compara con lo que haya
        al final.
      </p>
      <label className="field-label mt-5" htmlFor="fondo-inicial">
        Cambio inicial
      </label>
      <input
        id="fondo-inicial"
        type="number"
        step="0.01"
        min="0"
        required
        autoFocus
        value={fondo}
        onChange={(e) => setFondo(e.target.value)}
        className="field font-ticket !mb-0"
        placeholder="Ej: 20.00"
      />
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Montos frecuentes">
        {FONDOS_RAPIDOS.map((centavos) => (
          <button
            key={centavos}
            type="button"
            onClick={() => setFondo((centavos / 100).toFixed(2))}
            className={`rounded-full border px-3 py-1.5 font-ticket text-xs font-semibold transition-colors ${
              fondoCentavos === centavos
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white text-tinta hover:border-tinta'
            }`}
          >
            {formatearCentavos(centavos)}
          </button>
        ))}
      </div>
      {error && <MensajeError>{error}</MensajeError>}
      <Button
        type="submit"
        variant="success"
        className="mt-5 w-full"
        disabled={enviando || fondoCentavos === null}
      >
        {enviando ? 'Abriendo…' : 'Abrir caja'}
      </Button>
    </form>
  );
}

// --- Retiros e ingresos ---

export function FormularioMovimiento({ onRegistrado }: { onRegistrado: (t: TurnoCaja) => void }) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [tipo, setTipo] = useState<TipoMovimientoCaja>('retiro');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const montoCentavos = aCentavos(monto);
  // Mientras se escribe: el botón queda gris y acá se dice por qué.
  const problemaMotivo = problemaDelLargo(motivo, 3);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (!token || !montoCentavos) return;
    setEnviando(true);
    setError(null);
    try {
      onRegistrado(await registrarMovimientoCaja(token, { tipo, montoCentavos, motivo }));
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={registrar} className="space-y-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de movimiento">
        {(
          [
            ['retiro', 'Sacar efectivo', 'Pago a un proveedor, depósito…'],
            ['ingreso', 'Poner efectivo', 'Más cambio para el cajón'],
          ] as const
        ).map(([valor, texto, ayuda]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={tipo === valor}
            onClick={() => setTipo(valor)}
            className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
              tipo === valor ? 'border-tinta bg-tinta text-papel' : 'border-papel-linea bg-white'
            }`}
          >
            <span className="block text-sm font-semibold">{texto}</span>
            <span
              className={`block text-xs ${tipo === valor ? 'text-papel/75' : 'text-tinta-suave'}`}
            >
              {ayuda}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div>
          <label className="field-label" htmlFor="movimiento-monto">
            Monto
          </label>
          <input
            id="movimiento-monto"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="field font-ticket !mb-0"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="movimiento-motivo">
            Motivo (queda registrado)
          </label>
          <input
            id="movimiento-motivo"
            required
            minLength={3}
            maxLength={200}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-describedby="movimiento-motivo-aviso"
            className="field !mb-0"
            placeholder={
              tipo === 'retiro' ? 'Ej: pago al proveedor del pan' : 'Ej: monedas para cambio'
            }
          />
          <AvisoDeCampo id="movimiento-motivo-aviso" ayuda={problemaMotivo} />
        </div>
      </div>
      {error && <MensajeError>{error}</MensajeError>}
      <VentanaPie>
        <Button
          type="submit"
          variant="primary"
          disabled={enviando || !montoCentavos || motivo.trim().length < 3}
        >
          {enviando ? 'Guardando…' : 'Registrar'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar} disabled={enviando}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

export function ListaMovimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  if (movimientos.length === 0) return null;
  return (
    <ul className="divide-y divide-papel-linea text-sm">
      {movimientos.map((m) => (
        <li key={m.id} className="flex items-baseline justify-between gap-3 py-2">
          <span className="min-w-0 text-tinta">
            <span className="font-ticket text-xs text-tinta-suave">{horaDe(m.createdAt)}</span> ·{' '}
            {m.motivo}
            <span className="text-xs text-tinta-suave"> · {m.usuario}</span>
          </span>
          <span
            className={`shrink-0 font-ticket font-semibold ${
              m.tipo === 'retiro' ? 'text-rojo-perdida' : 'text-verde-ganancia'
            }`}
          >
            {m.tipo === 'retiro' ? '−' : '+'}
            {formatearCentavos(m.montoCentavos)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- Cerrar (conteo a ciegas) ---

/**
 * Se cuenta lo que hay en el cajón, billete por billete o escribiendo el
 * total, y recién después de cerrar se ve cuánto debería haber.
 */
export function FormularioCierre({
  turnoId,
  onCerrado,
}: {
  // Otro turno (el admin cierra el de un cajero). Sin id: el propio.
  turnoId?: string;
  onCerrado: (t: TurnoCaja) => void;
}) {
  const { token } = useAuth();
  const { cerrar: cerrarVentana } = useVentana();
  const [modo, setModo] = useState<'billetes' | 'total'>('billetes');
  const [conteo, setConteo] = useState<Record<number, number>>({});
  const [totalEscrito, setTotalEscrito] = useState('');
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const contado = modo === 'billetes' ? totalDelConteo(conteo) : aCentavos(totalEscrito);

  async function cerrar() {
    if (!token || contado === null) return;
    setEnviando(true);
    setError(null);
    try {
      onCerrado(
        await cerrarCaja(
          token,
          { efectivoContadoCentavos: contado, nota: nota || undefined },
          turnoId,
        ),
      );
      cerrarVentana();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar la caja');
      setEnviando(false);
      setConfirmando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setConfirmando(true);
      }}
    >
      <div className="flex gap-2" role="radiogroup" aria-label="Cómo contar">
        {(
          [
            ['billetes', 'Por billetes y monedas'],
            ['total', 'Escribir el total'],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={modo === valor}
            onClick={() => setModo(valor)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              modo === valor
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white text-tinta'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === 'billetes' ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {DENOMINACIONES.map((d) => (
            <label key={d.centavos} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-ticket text-tinta">
                {d.texto}
                <span className="ml-1 text-xs text-tinta-suave">
                  {d.tipo === 'billete' ? 'billete' : 'moneda'}
                </span>
              </span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={conteo[d.centavos] || ''}
                onChange={(e) =>
                  setConteo((prev) => ({
                    ...prev,
                    [d.centavos]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="field font-ticket !mb-0 w-20 !py-1.5 text-right"
                aria-label={`Cantidad de ${d.tipo === 'billete' ? 'billetes' : 'monedas'} de ${d.texto}`}
                placeholder="0"
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <label className="field-label" htmlFor="total-contado">
            Total contado
          </label>
          <input
            id="total-contado"
            type="number"
            step="0.01"
            min="0"
            value={totalEscrito}
            onChange={(e) => setTotalEscrito(e.target.value)}
            className="field font-ticket !mb-0"
            placeholder="0.00"
          />
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between rounded-xl bg-papel px-4 py-3">
        <span className="text-sm font-medium text-tinta">Contaste</span>
        <span className="font-ticket text-2xl font-semibold text-tinta">
          {contado === null ? '—' : formatearCentavos(contado)}
        </span>
      </div>

      <label className="field-label mt-4" htmlFor="nota-cierre">
        Nota (opcional)
      </label>
      <input
        id="nota-cierre"
        maxLength={300}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="field !mb-0"
        placeholder="Ej: un cliente no esperó su vuelto"
      />

      {error && <MensajeError>{error}</MensajeError>}

      {confirmando && (
        <p className="entra mt-4 rounded-xl border border-tinta/15 p-4 text-sm text-tinta">
          ¿Cerrar la caja con{' '}
          <strong className="font-ticket">{formatearCentavos(contado ?? 0)}</strong>? Después no se
          puede cambiar el conteo.
        </p>
      )}

      <VentanaPie>
        {confirmando ? (
          <>
            <Button type="button" variant="primary" onClick={cerrar} disabled={enviando}>
              {enviando ? 'Cerrando…' : 'Sí, cerrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
            >
              Volver a contar
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" variant="primary" disabled={contado === null}>
              Cerrar caja
            </Button>
            <Button type="button" variant="ghost" onClick={cerrarVentana}>
              Cancelar
            </Button>
          </>
        )}
      </VentanaPie>
    </form>
  );
}

// --- Resultado ---

const COLOR_DIFERENCIA = {
  ok: 'bg-verde-ganancia/10 text-verde-ganancia',
  falta: 'bg-rojo-perdida/10 text-rojo-perdida',
  sobra: 'bg-ambar/15 text-[#9a5b08]',
} as const;

/** Esperado, contado y diferencia, con el desglose que explica lo esperado. */
export function ResultadoArqueo({ turno }: { turno: TurnoCaja }) {
  if (turno.efectivoEsperadoCentavos === undefined) return null;
  const diferencia = turno.diferenciaCentavos;
  const filas: [string, number, string?][] = [
    ['Cambio inicial', turno.fondoInicialCentavos],
    ['Ventas en efectivo', turno.ventasEfectivoCentavos ?? 0, '+'],
    ...(turno.ingresosCentavos > 0
      ? [['Efectivo puesto', turno.ingresosCentavos, '+'] as [string, number, string]]
      : []),
    ...(turno.retirosCentavos > 0
      ? [['Efectivo sacado', turno.retirosCentavos, '−'] as [string, number, string]]
      : []),
  ];

  return (
    <div className="space-y-3">
      {diferencia !== undefined && (
        <div
          className={`rounded-xl px-4 py-3 ${COLOR_DIFERENCIA[tonoDiferencia(diferencia)]}`}
          role="status"
        >
          <p className="font-display text-xl font-bold">{textoDiferencia(diferencia)}</p>
          <p className="text-sm opacity-90">
            Contado {formatearCentavos(turno.efectivoContadoCentavos!)} · debía haber{' '}
            {formatearCentavos(turno.efectivoEsperadoCentavos)}
          </p>
        </div>
      )}
      <dl className="space-y-1 text-sm">
        {filas.map(([texto, monto, signo]) => (
          <div key={texto} className="flex justify-between gap-3">
            <dt className="text-tinta-suave">{texto}</dt>
            <dd className="font-ticket text-tinta">
              {signo ? `${signo} ` : ''}
              {formatearCentavos(monto)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-papel-linea pt-1 font-semibold">
          <dt className="text-tinta">Efectivo que debía haber</dt>
          <dd className="font-ticket text-tinta">
            {formatearCentavos(turno.efectivoEsperadoCentavos)}
          </dd>
        </div>
        {turno.ventasTransferenciaCentavos > 0 && (
          <div className="flex justify-between gap-3 pt-2 text-tinta-suave">
            <dt>Cobrado por transferencia (no está en el cajón)</dt>
            <dd className="font-ticket">{formatearCentavos(turno.ventasTransferenciaCentavos)}</dd>
          </div>
        )}
        {turno.ventasFiadoCentavos > 0 && (
          <div className="flex justify-between gap-3 pt-1 text-tinta-suave">
            <dt>Vendido al fiado (no está en el cajón)</dt>
            <dd className="font-ticket">{formatearCentavos(turno.ventasFiadoCentavos)}</dd>
          </div>
        )}
      </dl>
      {turno.nota && <p className="text-sm text-tinta-suave">Nota: “{turno.nota}”</p>}
    </div>
  );
}
