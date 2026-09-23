'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { useAuth } from '@/lib/auth-context';
import { actualizarTienda, obtenerTienda, ApiError } from '@/lib/api';
import { problemaDelRuc } from '@/lib/ruc';
import type { Tienda } from '@/lib/tipos';

const CAMPOS = [
  {
    clave: 'nombre',
    etiqueta: 'Nombre de la tienda',
    ayuda: 'El del letrero. Sale arriba en el ticket y en la app.',
    placeholder: 'Ej: Minimarket La Esquina',
    max: 150,
  },
  {
    clave: 'razonSocial',
    etiqueta: 'Razón social (opcional)',
    ayuda: 'Como figura en el SRI, si es distinta del nombre.',
    placeholder: 'Ej: Pérez López Juan Carlos',
    max: 200,
  },
  {
    clave: 'ruc',
    etiqueta: 'RUC (opcional)',
    ayuda: '13 números: tu cédula seguida de 001, si sos persona natural.',
    placeholder: 'Ej: 1712345678001',
    max: 15,
  },
  {
    clave: 'direccion',
    etiqueta: 'Dirección (opcional)',
    ayuda: null,
    placeholder: 'Ej: Av. Amazonas N24-03 y Colón, Quito',
    max: 250,
  },
  {
    clave: 'telefono',
    etiqueta: 'Teléfono (opcional)',
    ayuda: null,
    placeholder: 'Ej: 099 123 4567',
    max: 30,
  },
  {
    clave: 'mensajeTicket',
    etiqueta: 'Mensaje al pie del ticket (opcional)',
    ayuda: 'Horario, redes sociales, promociones…',
    placeholder: 'Ej: Abierto todos los días de 7h a 21h',
    max: 200,
  },
] as const;

type Clave = (typeof CAMPOS)[number]['clave'];
type Formulario = Record<Clave, string>;

function aFormulario(tienda: Tienda): Formulario {
  return {
    nombre: tienda.nombre,
    razonSocial: tienda.razonSocial ?? '',
    ruc: tienda.ruc ?? '',
    direccion: tienda.direccion ?? '',
    telefono: tienda.telefono ?? '',
    mensajeTicket: tienda.mensajeTicket ?? '',
  };
}

/** Cómo va a salir el encabezado (y el pie) del ticket con estos datos. */
function VistaPrevia({ datos }: { datos: Formulario }) {
  const nombre = datos.nombre.trim() || 'Tu tienda';
  return (
    <div className="mx-auto w-[72mm] bg-white p-3 font-ticket text-[12px] leading-snug text-black shadow-sm">
      <div className="text-center">
        <p className="text-[1.15em] font-bold uppercase">{nombre}</p>
        {datos.razonSocial.trim() && datos.razonSocial.trim() !== nombre && (
          <p>{datos.razonSocial.trim()}</p>
        )}
        {datos.ruc.trim() && <p>RUC {datos.ruc.replace(/[\s-]/g, '')}</p>}
        {datos.direccion.trim() && <p>{datos.direccion.trim()}</p>}
        {datos.telefono.trim() && <p>Tel. {datos.telefono.trim()}</p>}
        <div className="my-2 border-t border-dashed border-black" />
        <p>Ticket #0245</p>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center text-[#666]">(productos, total, vuelto)</p>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">
        <p>¡Gracias por su compra!</p>
        {datos.mensajeTicket.trim() && <p className="mt-1">{datos.mensajeTicket.trim()}</p>}
      </div>
    </div>
  );
}

function ContenidoTienda() {
  const { token } = useAuth();
  const [guardada, setGuardada] = useState<Tienda | null>(null);
  const [datos, setDatos] = useState<Formulario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  function cargar() {
    if (!token) return;
    setError(null);
    obtenerTienda(token)
      .then((t) => {
        setGuardada(t);
        setDatos(aFormulario(t));
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los datos'),
      );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const problemaRuc = datos ? problemaDelRuc(datos.ruc) : null;
  const cambios =
    guardada && datos && JSON.stringify(aFormulario(guardada)) !== JSON.stringify(datos);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!token || !datos || problemaRuc) return;
    setGuardando(true);
    setErrorGuardar(null);
    setListo(false);
    try {
      const t = await actualizarTienda(token, datos);
      setGuardada(t);
      setDatos(aFormulario(t));
      setListo(true);
    } catch (err) {
      setErrorGuardar(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <Banda
        eyebrow="Configuración"
        titulo="Datos de la tienda"
        detalle="Lo que sale en el ticket: nombre, RUC, dirección y un mensaje al pie."
      />
      <Hoja>
        <div className="mt-4">
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
          {!datos && !error && <LoadingState label="Cargando…" />}
          {datos && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <form onSubmit={guardar} className="app-card space-y-4 p-5 sm:p-6">
                {CAMPOS.map((campo) => {
                  const esRuc = campo.clave === 'ruc';
                  const idAyuda = `ayuda-${campo.clave}`;
                  return (
                    <div key={campo.clave}>
                      <label className="field-label" htmlFor={`tienda-${campo.clave}`}>
                        {campo.etiqueta}
                      </label>
                      <input
                        id={`tienda-${campo.clave}`}
                        value={datos[campo.clave]}
                        onChange={(e) => {
                          setListo(false);
                          setDatos({ ...datos, [campo.clave]: e.target.value });
                        }}
                        required={campo.clave === 'nombre'}
                        minLength={campo.clave === 'nombre' ? 2 : undefined}
                        maxLength={campo.max}
                        inputMode={esRuc ? 'numeric' : undefined}
                        aria-invalid={esRuc && !!problemaRuc}
                        aria-describedby={
                          campo.ayuda || (esRuc && problemaRuc) ? idAyuda : undefined
                        }
                        className={`field !mb-0 ${esRuc ? 'font-ticket' : ''}`}
                        placeholder={campo.placeholder}
                      />
                      {esRuc && problemaRuc ? (
                        <p id={idAyuda} className="mt-1 text-xs text-rojo-perdida" role="alert">
                          {problemaRuc}
                        </p>
                      ) : (
                        campo.ayuda && (
                          <p id={idAyuda} className="mt-1 text-xs text-tinta-suave">
                            {campo.ayuda}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}

                {errorGuardar && (
                  <p className="rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
                    {errorGuardar}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={guardando || !cambios || !!problemaRuc}
                  >
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </Button>
                  {listo && (
                    <span className="text-sm text-verde-ganancia" role="status">
                      Guardado. Los próximos tickets salen así.
                    </span>
                  )}
                </div>
              </form>

              <aside className="lg:sticky lg:top-24">
                <p className="field-label text-center">Así sale en el ticket</p>
                <VistaPrevia datos={datos} />
              </aside>
            </div>
          )}
        </div>
      </Hoja>
    </div>
  );
}

export default function TiendaPage() {
  return (
    <RutaProtegida soloAdmin>
      <Nav />
      <ContenidoTienda />
    </RutaProtegida>
  );
}
