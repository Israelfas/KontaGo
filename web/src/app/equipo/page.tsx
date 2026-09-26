'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { AvisoDeCampo, Button, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { Ficha } from '@/components/ficha';
import { ActivityIcon, LockIcon, PencilIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { ActividadDeLaCuenta } from '@/components/actividad-cuenta';
import { haceCuanto } from '@/lib/actividad';
import { Ventana, VentanaPie, useVentana } from '@/components/ventana';
import { useAuth } from '@/lib/auth-context';
import {
  listarEquipo,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
  cambiarPasswordUsuario,
  desbloquearUsuario,
  ApiError,
} from '@/lib/api';
import type { UsuarioEquipo } from '@/lib/tipos';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import { useCamposTocados } from '@/lib/use-campos-tocados';
import {
  ayudaDeLaContrasena,
  problemaDeLaContrasena,
  problemaDelEmail,
  problemaDelNombre,
} from '@/lib/validacion';

const ETIQUETA_ROL: Record<UsuarioEquipo['rol'], string> = {
  admin: 'Admin',
  cajero: 'Cajero',
};

// Mismo ámbar que la etiqueta de rol del nav para el admin.
const CLASE_ROL: Record<UsuarioEquipo['rol'], string> = {
  admin: 'status-pill-warning',
  cajero: 'status-pill-neutral',
};

function FormularioNuevaPersona({ onCreado }: { onCreado: (u: UsuarioEquipo) => void }) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UsuarioEquipo['rol']>('cajero');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { tocado, salir, tocarTodos } = useCamposTocados<'nombre' | 'email' | 'password'>();
  const problemas = {
    nombre: problemaDelNombre(nombre),
    email: problemaDelEmail(email),
    password: problemaDeLaContrasena(password, email),
  };

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (Object.values(problemas).some(Boolean)) {
      tocarTodos(['nombre', 'email', 'password']);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      onCreado(await crearUsuario(token, { nombre, email, password, rol }));
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
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
            onBlur={salir('nombre')}
            aria-invalid={tocado('nombre') && !!problemas.nombre}
            aria-describedby="persona-nombre-aviso"
            className="field"
            placeholder="Pedro Gómez"
          />
          <AvisoDeCampo
            id="persona-nombre-aviso"
            error={tocado('nombre') ? problemas.nombre : null}
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
            onBlur={salir('email')}
            aria-invalid={tocado('email') && !!problemas.email}
            aria-describedby="persona-email-aviso"
            className="field"
            placeholder="pedro@correo.com"
          />
          <AvisoDeCampo id="persona-email-aviso" error={tocado('email') ? problemas.email : null} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="field-label" htmlFor="persona-password">
            Contraseña inicial
          </label>
          <input
            id="persona-password"
            required
            minLength={8}
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={salir('password')}
            aria-invalid={tocado('password') && !!problemas.password}
            aria-describedby="persona-password-aviso"
            className="field font-ticket"
            placeholder="Al menos 8 caracteres"
          />
          <AvisoDeCampo
            id="persona-password-aviso"
            error={tocado('password') ? problemas.password : null}
            ayuda={
              ayudaDeLaContrasena(password) ??
              'Pásasela a la persona; puedes cambiarla después desde aquí.'
            }
          />
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
            <option value="admin">Admin: acceso completo, como tú</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

function FormularioCambiarPassword({
  persona,
  onListo,
}: {
  persona: UsuarioEquipo;
  onListo: () => void;
}) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [salio, setSalio] = useState(false);
  const problema = problemaDeLaContrasena(password);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (problema) {
      setSalio(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await cambiarPasswordUsuario(token, persona.id, password);
      onListo();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      <label className="field-label" htmlFor={`password-${persona.id}`}>
        Nueva contraseña
      </label>
      <input
        id={`password-${persona.id}`}
        required
        minLength={8}
        type="text"
        autoComplete="off"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onBlur={() => setSalio(true)}
        aria-invalid={salio && !!problema}
        aria-describedby={`password-${persona.id}-aviso`}
        className="field font-ticket"
        placeholder="Al menos 8 caracteres"
      />
      <AvisoDeCampo
        id={`password-${persona.id}-aviso`}
        error={salio ? problema : null}
        ayuda={ayudaDeLaContrasena(password)}
      />
      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

/** Ficha, nombre y correo de alguien del equipo. */
function DatosDePersona({ persona, esVos }: { persona: UsuarioEquipo; esVos: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Ficha nombre={persona.nombre} redonda />
      <div className="min-w-0">
        <p className="truncate font-medium text-tinta">
          {persona.nombre}
          {esVos && <span className="ml-1.5 text-xs font-normal text-tinta-suave">(tú)</span>}
        </p>
        <p className="truncate text-xs text-tinta-suave" title={persona.email}>
          {persona.email}
        </p>
      </div>
    </div>
  );
}

/** Si puede entrar: activa, bloqueada por intentos o desactivada. */
function EstadoDePersona({ persona }: { persona: UsuarioEquipo }) {
  if (!persona.activo) {
    return <span className="status-pill status-pill-neutral">Desactivada</span>;
  }
  if (persona.bloqueadoHasta) {
    return <span className="status-pill status-pill-danger">Bloqueada</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className="status-pill status-pill-ok">Activa</span>
      {persona.dosPasos && (
        <span className="status-pill status-pill-abierta" title="Usa la verificación en dos pasos">
          <LockIcon className="h-3 w-3" />2 pasos
        </span>
      )}
    </span>
  );
}

function ContenidoEquipo() {
  const { token, usuario } = useAuth();
  const pantallaChica = usePantallaChica();
  const [equipo, setEquipo] = useState<UsuarioEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState<UsuarioEquipo | null>(null);
  const [viendoActividad, setViendoActividad] = useState<UsuarioEquipo | null>(null);
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

  // Las respuestas de una sola persona no traen el último ingreso: se
  // conserva el que ya estaba en la lista.
  function reemplazar(actualizado: UsuarioEquipo) {
    setEquipo((prev) => prev.map((u) => (u.id === actualizado.id ? { ...u, ...actualizado } : u)));
  }

  async function desbloquear(persona: UsuarioEquipo) {
    if (!token) return;
    setErrorAccion(null);
    setProcesandoId(persona.id);
    try {
      reemplazar(await desbloquearUsuario(token, persona.id));
      setAviso(`${persona.nombre} ya puede volver a entrar.`);
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo desbloquear');
    } finally {
      setProcesandoId(null);
    }
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

  // Las mismas acciones en la tabla y en las tarjetas del celular.
  function acciones(persona: UsuarioEquipo, esVos: boolean, alinear?: 'derecha') {
    return (
      <div className={`flex gap-2 ${alinear === 'derecha' ? 'justify-end' : 'flex-wrap'}`}>
        {persona.bloqueadoHasta && (
          <button
            type="button"
            disabled={procesandoId !== null}
            onClick={() => desbloquear(persona)}
            className="boton-tarjeta boton-tarjeta-alerta disabled:opacity-50"
          >
            <LockIcon className="h-3.5 w-3.5" />
            Desbloquear
          </button>
        )}
        <button type="button" onClick={() => setViendoActividad(persona)} className="boton-tarjeta">
          <ActivityIcon className="h-3.5 w-3.5" />
          Actividad
        </button>
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setCambiandoPassword(persona);
          }}
          className="boton-tarjeta"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Cambiar contraseña
        </button>
        {/* Uno no puede desactivarse a sí mismo: la tienda podría quedar
            sin nadie que la administre. */}
        {!esVos && (
          <button
            type="button"
            disabled={procesandoId !== null}
            onClick={() => alternarActivo(persona)}
            className={`boton-tarjeta disabled:opacity-50 ${persona.activo ? 'boton-tarjeta-peligro' : ''}`}
          >
            {procesandoId === persona.id
              ? 'Guardando…'
              : persona.activo
                ? 'Desactivar'
                : 'Reactivar'}
          </button>
        )}
      </div>
    );
  }

  const activas = equipo.filter((p) => p.activo);

  return (
    <div>
      <Banda
        eyebrow="Tienda"
        titulo="Equipo"
        valor={equipo.length > 0 ? String(equipo.length) : undefined}
        detalle={
          equipo.length > 0
            ? 'Los cajeros venden y consultan productos; no ven ganancias ni inventario.'
            : 'Las personas que usan KontaGo en tu tienda.'
        }
        extra={
          equipo.length > 0 && (
            <div className="banda-datos">
              <div className="banda-dato">
                <span className="banda-dato-etiqueta">Con acceso</span>
                <span className="banda-dato-valor">
                  {activas.length}
                  <span className="banda-dato-nota">
                    {' '}
                    · {activas.filter((p) => p.rol === 'admin').length} admin,{' '}
                    {activas.filter((p) => p.rol === 'cajero').length} cajeros
                  </span>
                </span>
              </div>
              <div className="banda-dato">
                <span className="banda-dato-etiqueta">Con verificación en 2 pasos</span>
                <span className="banda-dato-valor">
                  {activas.filter((p) => p.dosPasos).length}
                  <span className="banda-dato-nota"> de {activas.length}</span>
                </span>
              </div>
              {equipo.some((p) => p.bloqueadoHasta) && (
                <div className="banda-dato banda-dato-alerta">
                  <span className="banda-dato-etiqueta">Bloqueadas</span>
                  <span className="banda-dato-valor">
                    {equipo.filter((p) => p.bloqueadoHasta).length}
                  </span>
                </div>
              )}
              {equipo.length > activas.length && (
                <div className="banda-dato">
                  <span className="banda-dato-etiqueta">Desactivadas</span>
                  <span className="banda-dato-valor">{equipo.length - activas.length}</span>
                </div>
              )}
            </div>
          )
        }
        accion={
          <Button variant="claro" onClick={() => setAgregando(true)}>
            <PlusIcon className="h-4 w-4" />
            Agregar persona
          </Button>
        }
      />

      <Hoja>
        <div className="mt-8 space-y-6">
          {agregando && (
            <Ventana
              titulo="Agregar persona"
              descripcion="Entra con su email y la contraseña que le pases."
              icono={<UsersIcon className="h-5 w-5" />}
              onCerrar={() => setAgregando(false)}
            >
              <FormularioNuevaPersona onCreado={(u) => setEquipo((prev) => [...prev, u])} />
            </Ventana>
          )}

          {viendoActividad && (
            <Ventana
              titulo={
                viendoActividad.id === usuario?.sub
                  ? 'Tu actividad'
                  : `Actividad de ${viendoActividad.nombre}`
              }
              descripcion={`${viendoActividad.email} · dónde tiene la sesión abierta y lo último que pasó con la cuenta.`}
              icono={<ActivityIcon className="h-5 w-5" />}
              onCerrar={() => setViendoActividad(null)}
            >
              <ActividadDeLaCuenta
                persona={viendoActividad}
                esVos={viendoActividad.id === usuario?.sub}
                onCambio={(actualizada) => {
                  reemplazar(actualizada);
                  setAviso(`${actualizada.nombre} ya puede entrar solo con su contraseña.`);
                }}
              />
            </Ventana>
          )}

          {cambiandoPassword && (
            <Ventana
              titulo="Cambiar contraseña"
              descripcion={
                // Cambiarla cierra las sesiones de esa persona, también la propia.
                cambiandoPassword.id === usuario?.sub
                  ? 'Es la tuya: al guardarla se cierra tu sesión y entras de nuevo con la nueva.'
                  : `De ${cambiandoPassword.nombre}. Pásasela en persona: la vieja deja de servir y se cierran sus sesiones.`
              }
              icono={<PencilIcon className="h-5 w-5" />}
              onCerrar={() => setCambiandoPassword(null)}
            >
              <FormularioCambiarPassword
                persona={cambiandoPassword}
                onListo={() => setAviso(`Contraseña de ${cambiandoPassword.nombre} actualizada.`)}
              />
            </Ventana>
          )}

          {cargando && <LoadingState label="Cargando equipo…" />}

          {error && !cargando && (
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

          {/* En celular la tabla cortaba el rol y las acciones: tarjetas. */}
          {!cargando && !error && pantallaChica && (
            <ul className="space-y-3">
              {equipo.map((persona) => {
                const esVos = persona.id === usuario?.sub;
                return (
                  <li
                    key={persona.id}
                    className={`app-card p-4 ${persona.activo ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <DatosDePersona persona={persona} esVos={esVos} />
                      <span className={`status-pill ${CLASE_ROL[persona.rol]} shrink-0 text-xs`}>
                        {ETIQUETA_ROL[persona.rol]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-papel-linea pt-3">
                      <EstadoDePersona persona={persona} />
                      <span className="text-xs text-tinta-suave">
                        {persona.ultimoIngreso
                          ? `Entró ${haceCuanto(persona.ultimoIngreso)}`
                          : 'Todavía no entró'}
                      </span>
                    </div>
                    <div className="mt-3">{acciones(persona, esVos)}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {!cargando && !error && !pantallaChica && (
            <div className="table-shell">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-24" />
                  <col className="w-40" />
                  <col className="w-36" />
                  <col className="w-[26rem]" />
                </colgroup>
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">Persona</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Último ingreso</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
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
                        <td className="px-4 py-3">
                          <DatosDePersona persona={persona} esVos={esVos} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`status-pill ${CLASE_ROL[persona.rol]} text-xs`}>
                            {ETIQUETA_ROL[persona.rol]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <EstadoDePersona persona={persona} />
                        </td>
                        <td className="px-4 py-3 text-xs text-tinta-suave">
                          {persona.ultimoIngreso ? haceCuanto(persona.ultimoIngreso) : 'Nunca'}
                        </td>
                        <td className="px-4 py-3">{acciones(persona, esVos, 'derecha')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Hoja>
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
