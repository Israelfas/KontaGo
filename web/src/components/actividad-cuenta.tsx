'use client';

import { useEffect, useState } from 'react';
import { Button, LoadingState } from './ui';
import { VentanaPie, useVentana } from './ventana';
import { useAuth } from '@/lib/auth-context';
import { ApiError, cerrarSesionesDe, obtenerActividad, quitarDosPasos } from '@/lib/api';
import { EVENTOS, haceCuanto, type ActividadDeCuenta } from '@/lib/actividad';
import type { UsuarioEquipo } from '@/lib/tipos';

/**
 * Dónde tiene la sesión abierta una persona del equipo y qué pasó con su
 * cuenta (ISO/IEC 27002:2022, 8.15 y 8.16). Desde acá se cierran todas
 * sus sesiones: si perdió el celular, o si hay un dispositivo que nadie
 * reconoce.
 */
export function ActividadDeLaCuenta({
  persona,
  esVos,
  onCambio,
}: {
  persona: UsuarioEquipo;
  esVos: boolean;
  /** La persona cambió (se le quitó la verificación en dos pasos). */
  onCambio?: (actualizada: UsuarioEquipo) => void;
}) {
  const { token, cerrarSesion } = useAuth();
  const { cerrar } = useVentana();
  const [actividad, setActividad] = useState<ActividadDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [quitando, setQuitando] = useState<'confirmar' | 'enviando' | null>(null);
  const [dosPasos, setDosPasos] = useState(persona.dosPasos);

  // Perdió el celular y los códigos de recuperación: entra con su
  // contraseña y la vuelve a activar.
  async function quitarVerificacion() {
    if (!token) return;
    setQuitando('enviando');
    try {
      const actualizada = await quitarDosPasos(token, persona.id);
      setDosPasos(false);
      onCambio?.(actualizada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la verificación');
    } finally {
      setQuitando(null);
    }
  }
  // Intentos sospechosos de la última semana, contados al llegar los datos.
  const [alertasRecientes, setAlertasRecientes] = useState(0);

  useEffect(() => {
    if (!token) return;
    obtenerActividad(token, persona.id)
      .then((a) => {
        const haceUnaSemana = Date.now() - 7 * 86_400_000;
        setAlertasRecientes(
          a.eventos.filter(
            (e) => EVENTOS[e.tipo]?.alerta && new Date(e.fecha).getTime() > haceUnaSemana,
          ).length,
        );
        setActividad(a);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la actividad'),
      );
  }, [token, persona.id]);

  async function cerrarTodas() {
    if (!token) return;
    setCerrando(true);
    try {
      await cerrarSesionesDe(token, persona.id);
      if (esVos) {
        // También se cerró esta: a volver a entrar.
        await cerrarSesion();
        return;
      }
      setActividad((a) => (a ? { ...a, sesiones: [] } : a));
      setConfirmando(false);
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cerrar las sesiones');
    } finally {
      setCerrando(false);
    }
  }

  if (error) {
    return <p className="pb-5 text-sm text-rojo-perdida">{error}</p>;
  }
  if (!actividad) return <LoadingState label="Cargando actividad…" />;

  return (
    <div>
      {alertasRecientes > 0 && (
        <p className="mb-4 rounded-xl border border-rojo-perdida/25 bg-rojo-perdida/[0.06] px-3.5 py-2.5 text-sm text-rojo-perdida">
          {alertasRecientes === 1
            ? 'Hubo un intento fallido'
            : `Hubo ${alertasRecientes} intentos fallidos`}{' '}
          en la última semana. Si no {esVos ? 'fuiste tú' : `fue ${persona.nombre}`}, conviene
          cambiar la contraseña.
        </p>
      )}

      <h3 className="field-label">Sesiones abiertas</h3>
      {actividad.sesiones.length === 0 ? (
        <p className="text-sm text-tinta-suave">No tiene la sesión abierta en ningún lado.</p>
      ) : (
        <ul className="divide-y divide-papel-linea rounded-xl border border-papel-linea">
          {actividad.sesiones.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-tinta">
                  {s.dispositivo}
                  {s.esEsta && (
                    <span className="status-pill status-pill-ok ml-2 text-[0.65rem]">
                      Este dispositivo
                    </span>
                  )}
                </p>
                <p className="text-xs text-tinta-suave">
                  {s.ip ? `IP ${s.ip} · ` : ''}desde {haceCuanto(s.abiertaEn)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-tinta-suave">
                usó {haceCuanto(s.ultimoUso)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!esVos && dosPasos && (
        <div className="mt-5 rounded-xl border border-papel-linea px-3.5 py-3">
          <p className="text-sm text-tinta">
            <strong>Verificación en dos pasos activada.</strong>{' '}
            {quitando === 'confirmar'
              ? `${persona.nombre} va a poder entrar solo con su contraseña hasta que la vuelva a activar. Hazlo solo si perdió el celular y sus códigos de recuperación.`
              : 'Si perdió el celular y sus códigos de recuperación, se la puedes quitar.'}
          </p>
          <div className="mt-2 flex gap-2">
            {quitando === null ? (
              <Button type="button" variant="secondary" onClick={() => setQuitando('confirmar')}>
                Quitar la verificación
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="danger"
                  onClick={quitarVerificacion}
                  disabled={quitando === 'enviando'}
                >
                  {quitando === 'enviando' ? 'Quitando…' : 'Sí, quitarla'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setQuitando(null)}
                  disabled={quitando === 'enviando'}
                >
                  No
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <h3 className="field-label mt-5">Lo último que pasó</h3>
      {actividad.eventos.length === 0 ? (
        <p className="text-sm text-tinta-suave">Todavía no hay actividad registrada.</p>
      ) : (
        <ol className="space-y-2">
          {actividad.eventos.map((e, i) => {
            const info = EVENTOS[e.tipo] ?? { texto: e.tipo };
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    info.alerta ? 'bg-rojo-perdida' : 'bg-papel-linea'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className={info.alerta ? 'font-medium text-rojo-perdida' : 'text-tinta'}>
                    {info.texto}
                  </p>
                  <p className="text-xs text-tinta-suave">
                    {haceCuanto(e.fecha)}
                    {e.dispositivo ? ` · ${e.dispositivo}` : ''}
                    {e.ip ? ` · IP ${e.ip}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {confirmando && (
        <p className="entra mt-4 rounded-xl border border-rojo-perdida/30 bg-rojo-perdida/5 p-3 text-sm text-tinta">
          {esVos
            ? 'Se cierra tu sesión en todos lados, también en esta computadora: vas a tener que volver a entrar.'
            : `${persona.nombre} va a tener que volver a entrar en todos sus dispositivos.`}
        </p>
      )}
      <VentanaPie>
        {confirmando ? (
          <>
            <Button variant="danger" onClick={cerrarTodas} disabled={cerrando}>
              {cerrando ? 'Cerrando…' : 'Sí, cerrar todas'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={cerrando}>
              No
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmando(true)}
              disabled={actividad.sesiones.length === 0}
            >
              Cerrar sesión en todos {esVos ? 'tus' : 'sus'} dispositivos
            </Button>
            <Button variant="ghost" onClick={cerrar}>
              Listo
            </Button>
          </>
        )}
      </VentanaPie>
    </div>
  );
}
