'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError, cerrarMisSesiones } from '@/lib/api';

/**
 * El menú de la cuenta, arriba a la derecha: quién está adentro y cómo
 * salir. "Cerrar sesión en todos mis dispositivos" sirve a cualquiera
 * (también al cajero) si perdió el celular o entró en una computadora
 * ajena; pide confirmación porque también cierra esta sesión.
 *
 * Se abre desde el botón (el panel crece desde esa esquina) y se cierra
 * con Escape, tocando afuera o al elegir algo.
 */
export function MenuCuenta({
  nombre,
  email,
  rol,
}: {
  nombre: string | null;
  email: string | null;
  rol: 'admin' | 'cajero' | undefined;
}) {
  const { token, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    setConfirmando(false);
    setError(null);
    if (devolverFoco) botonRef.current?.focus();
  }, []);

  // Afuera o Escape: se cierra.
  useEffect(() => {
    if (!abierto) return;
    const alTocar = (e: PointerEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) cerrar(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('pointerdown', alTocar);
    document.addEventListener('keydown', alTeclear);
    // Al abrir, el foco va a la primera opción.
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', alTocar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, cerrar]);

  async function cerrarEnTodos() {
    if (!token) return;
    setCerrando(true);
    setError(null);
    try {
      await cerrarMisSesiones(token);
      // También se cerró esta: a volver a entrar.
      await cerrarSesion();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo. Revisa tu conexión.');
      setCerrando(false);
    }
  }

  const inicial = (nombre ?? email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={raizRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-label={`Tu cuenta${nombre ? `: ${nombre}` : ''}`}
        className="menu-cuenta-boton"
      >
        <span className="menu-cuenta-avatar" aria-hidden="true">
          {inicial}
        </span>
        {rol && (
          <span className="hidden font-ticket text-[0.65rem] font-semibold uppercase tracking-wider text-[#9a5b08] sm:inline">
            {rol}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-tinta-suave transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div ref={panelRef} id={idPanel} className="menu-cuenta-panel">
          <div className="px-4 pb-3 pt-4">
            <p className="truncate font-display text-base font-bold text-tinta">
              {nombre ?? 'Tu cuenta'}
            </p>
            {email && <p className="truncate text-sm text-tinta-suave">{email}</p>}
          </div>

          <div className="border-t border-papel-linea p-1.5">
            {confirmando ? (
              <div className="entra p-2.5">
                <p className="text-sm leading-6 text-tinta">
                  Se cierra tu sesión en todos lados, también aquí. Vas a tener que volver a entrar.
                </p>
                {error && (
                  <p role="alert" className="mt-2 text-sm text-rojo-perdida">
                    {error}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={cerrarEnTodos}
                    disabled={cerrando}
                    className="button button-danger flex-1"
                  >
                    {cerrando ? 'Cerrando…' : 'Sí, cerrar todas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={cerrando}
                    className="button button-ghost"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="menu-cuenta-opcion"
                  onClick={() => setConfirmando(true)}
                >
                  Cerrar sesión en todos mis dispositivos
                </button>
                <button
                  type="button"
                  className="menu-cuenta-opcion text-rojo-perdida"
                  onClick={() => {
                    cerrar(false);
                    void cerrarSesion();
                  }}
                >
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
