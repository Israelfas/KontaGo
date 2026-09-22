'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { PlusIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import {
  listarEquipo,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
  cambiarPasswordUsuario,
  ApiError,
} from '@/lib/api';
import type { UsuarioEquipo } from '@/lib/tipos';

const ETIQUETA_ROL: Record<UsuarioEquipo['rol'], string> = {
  admin: 'Admin',
  cajero: 'Cajero',
};

function FormularioNuevaPersona({
  onCreado,
  onCerrar,
}: {
  onCreado: (u: UsuarioEquipo) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UsuarioEquipo['rol']>('cajero');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      onCreado(await crearUsuario(token, { nombre, email, password, rol }));
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="field-label" htmlFor="persona-nombre">
            Nombre
          </label>
          <input
            id="persona-nombre"
            required
            minLength={2}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="field"
            placeholder="Pedro Gómez"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="field-label" htmlFor="persona-email">
            Email (con este entra)
          </label>
          <input
            id="persona-email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            placeholder="pedro@correo.com"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="field-label" htmlFor="persona-password">
            Contraseña inicial
          </label>
          <input
            id="persona-password"
            required
            minLength={6}
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field font-ticket"
            placeholder="Mínimo 6 caracteres"
          />
          <p className="mt-1 text-xs text-tinta-suave">
            Pasásela a la persona; podés cambiarla después desde acá.
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="field-label" htmlFor="persona-rol">
            Rol
          </label>
          <select
            id="persona-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as UsuarioEquipo['rol'])}
            className="field"
          >
            <option value="cajero">Cajero: vende y consulta productos</option>
            <option value="admin">Admin: acceso completo, como vos</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FormularioCambiarPassword({
  persona,
  onListo,
  onCerrar,
}: {
  persona: UsuarioEquipo;
  onListo: () => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await cambiarPasswordUsuario(token, persona.id, password);
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="app-card p-4 sm:p-5">
      <p className="text-sm font-semibold text-tinta">Nueva contraseña para {persona.nombre}</p>
      <input
        required
        minLength={6}
        type="text"
        autoComplete="off"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field mt-3 font-ticket"
        placeholder="Mínimo 6 caracteres"
        aria-label="Nueva contraseña"
      />
      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ContenidoEquipo() {
  const { token, usuario } = useAuth();
  const [equipo, setEquipo] = useState<UsuarioEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [cambiandoPasswordId, setCambiandoPasswordId] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  function cargar() {
    if (!token) return;
    setCargando(true);
    setError(null);
    listarEquipo(token)
      .then(setEquipo)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el equipo'),
      )
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function reemplazar(actualizado: UsuarioEquipo) {
    setEquipo((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)));
  }

  async function alternarActivo(persona: UsuarioEquipo) {
    if (!token) return;
    setErrorAccion(null);
    setAviso(null);
    setProcesandoId(persona.id);
    try {
      reemplazar(
        persona.activo
          ? await desactivarUsuario(token, persona.id)
          : await reactivarUsuario(token, persona.id),
      );
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo actualizar la cuenta');
    } finally {
      setProcesandoId(null);
    }
  }

  const personaCambiandoPassword = equipo.find((u) => u.id === cambiandoPasswordId);

  return (
    <div className="app-page">
      <div className="app-container">
        <PageHeader
          eyebrow="Tienda"
          title="Equipo"
          description="Las personas que usan KontaGo en tu tienda. Los cajeros venden y consultan productos; no ven ganancias ni inventario."
          action={
            !formularioAbierto && (
              <Button variant="primary" onClick={() => setFormularioAbierto(true)}>
                <PlusIcon className="h-4 w-4" />
                Agregar persona
              </Button>
            )
          }
        />

        <div className="mt-8 space-y-6">
          {formularioAbierto && (
            <FormularioNuevaPersona
              onCreado={(u) => setEquipo((prev) => [...prev, u])}
              onCerrar={() => setFormularioAbierto(false)}
            />
          )}

          {cargando && <LoadingState label="Cargando equipo…" />}

          {error && !cargando && (
            <ErrorState action={<Button variant="secondary" onClick={cargar}>Reintentar</Button>}>
              {error}
            </ErrorState>
          )}

          {errorAccion && (
            <p className="rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
              {errorAccion}
            </p>
          )}
          {aviso && (
            <p className="rounded-lg bg-verde-ganancia/10 px-3 py-2 text-sm text-verde-ganancia">
              {aviso}
            </p>
          )}

          {!cargando && !error && (
            <div className="table-shell">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {equipo.map((persona) => {
                    const esVos = persona.id === usuario?.sub;
                    return (
                      <tr
                        key={persona.id}
                        className={`border-t border-papel-linea ${persona.activo ? '' : 'opacity-60'}`}
                      >
                        <td className="px-4 py-3 text-tinta">
                          {persona.nombre}
                          {esVos && <span className="ml-2 text-xs text-tinta-suave">(vos)</span>}
                          {!persona.activo && (
                            <span className="ml-2 text-xs text-rojo-perdida">Desactivado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-tinta-suave">{persona.email}</td>
                        <td className="px-4 py-3">
                          <span className="status-pill font-ticket text-xs">
                            {ETIQUETA_ROL[persona.rol]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setAviso(null);
                                setCambiandoPasswordId(persona.id);
                              }}
                              className="text-xs font-medium text-tinta-suave underline hover:text-tinta"
                            >
                              Cambiar contraseña
                            </button>
                            {/* Uno no puede desactivarse a sí mismo: la tienda
                                podría quedar sin nadie que la administre. */}
                            {!esVos && (
                              <button
                                type="button"
                                disabled={procesandoId !== null}
                                onClick={() => alternarActivo(persona)}
                                className="text-xs font-medium text-tinta-suave underline hover:text-tinta disabled:opacity-50"
                              >
                                {procesandoId === persona.id
                                  ? 'Guardando…'
                                  : persona.activo
                                    ? 'Desactivar'
                                    : 'Reactivar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {personaCambiandoPassword && (
            <FormularioCambiarPassword
              persona={personaCambiandoPassword}
              onListo={() => {
                setAviso(`Contraseña de ${personaCambiandoPassword.nombre} actualizada.`);
                setCambiandoPasswordId(null);
              }}
              onCerrar={() => setCambiandoPasswordId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EquipoPage() {
  return (
    <RutaProtegida soloAdmin>
      <Nav />
      <ContenidoEquipo />
    </RutaProtegida>
  );
}
