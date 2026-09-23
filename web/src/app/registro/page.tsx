'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { AlertaDeFormulario, AvisoDeCampo, Button } from '@/components/ui';
import { CampoContrasena, MedidorDeFuerza } from '@/components/campo-contrasena';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { useCamposTocados } from '@/lib/use-campos-tocados';
import {
  faltanALaContrasena,
  fuerzaDeLaContrasena,
  problemaDeLaContrasena,
  problemaDelEmail,
  problemaDelNombre,
} from '@/lib/validacion';

export default function RegistroPage() {
  const { registrarse } = useAuth();
  const [nombreTienda, setNombreTienda] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [faltaAceptar, setFaltaAceptar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { tocado, salir, tocarTodos } = useCamposTocados<
    'tienda' | 'admin' | 'email' | 'password'
  >();

  const problemas = {
    tienda: problemaDelNombre(nombreTienda),
    admin: problemaDelNombre(nombreAdmin),
    email: problemaDelEmail(email),
    password: problemaDeLaContrasena(password, email),
  };
  const faltan = faltanALaContrasena(password);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (Object.values(problemas).some(Boolean) || !aceptaTerminos) {
      tocarTodos(['tienda', 'admin', 'email', 'password']);
      setFaltaAceptar(!aceptaTerminos);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await registrarse({ nombreTienda, nombreAdmin, email, password, aceptaTerminos });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar el registro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Creá tu espacio"
      title="Empezá con tu tienda"
      description="Configurá tu cuenta en unos minutos. Vas a quedar como administrador y podrás sumar a tu equipo después."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link
            href="/login"
            className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
          >
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="nombre-tienda">
              Nombre de la tienda
            </label>
            <input
              id="nombre-tienda"
              required
              value={nombreTienda}
              onChange={(evento) => setNombreTienda(evento.target.value)}
              onBlur={salir('tienda')}
              aria-invalid={tocado('tienda') && !!problemas.tienda}
              aria-describedby="nombre-tienda-aviso"
              className="field"
              placeholder="Mini Market El Sol"
            />
            <AvisoDeCampo
              id="nombre-tienda-aviso"
              error={tocado('tienda') ? problemas.tienda : null}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="nombre-admin">
              Tu nombre
            </label>
            <input
              id="nombre-admin"
              autoComplete="name"
              required
              value={nombreAdmin}
              onChange={(evento) => setNombreAdmin(evento.target.value)}
              onBlur={salir('admin')}
              aria-invalid={tocado('admin') && !!problemas.admin}
              aria-describedby="nombre-admin-aviso"
              className="field"
              placeholder="Juan Pérez"
            />
            <AvisoDeCampo
              id="nombre-admin-aviso"
              error={tocado('admin') ? problemas.admin : null}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="registro-email">
              Email
            </label>
            <input
              id="registro-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              onBlur={salir('email')}
              aria-invalid={tocado('email') && !!problemas.email}
              aria-describedby="registro-email-aviso"
              className="field"
              placeholder="admin@tutienda.com"
            />
            <AvisoDeCampo
              id="registro-email-aviso"
              error={tocado('email') ? problemas.email : null}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="registro-password">
              Contraseña
            </label>
            <CampoContrasena
              id="registro-password"
              value={password}
              onChange={setPassword}
              onBlur={salir('password')}
              autoComplete="new-password"
              invalido={tocado('password') && !!problemas.password}
              describedBy="registro-password-aviso"
              placeholder="Una frase de al menos 8 caracteres"
            />
            {/* La cuenta regresiva va desde la primera tecla: no es un error,
                es cuánto falta. En rojo recién si se sale sin completarla. */}
            <AvisoDeCampo
              id="registro-password-aviso"
              error={tocado('password') ? problemas.password : null}
              ayuda={
                password && faltan > 0
                  ? `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}.`
                  : null
              }
            />
            {faltan === 0 && <MedidorDeFuerza {...fuerzaDeLaContrasena(password)} />}
          </div>

          {/* Ley Orgánica de Protección de Datos Personales: consentimiento
              expreso, no una casilla ya marcada. */}
          <div>
            <label className="flex items-start gap-2.5 text-sm leading-5 text-tinta">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => {
                  setAceptaTerminos(e.target.checked);
                  if (e.target.checked) setFaltaAceptar(false);
                }}
                aria-invalid={faltaAceptar || undefined}
                aria-describedby="registro-terminos-aviso"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-papel-linea accent-[#1c2b3a]"
              />
              <span>
                Acepto los{' '}
                <Link href="/terminos" target="_blank" className="font-semibold underline">
                  términos y condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/privacidad" target="_blank" className="font-semibold underline">
                  política de privacidad
                </Link>
                .
              </span>
            </label>
            <AvisoDeCampo
              id="registro-terminos-aviso"
              error={faltaAceptar ? 'Para crear tu cuenta tenés que aceptarlos.' : null}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <AlertaDeFormulario>{error}</AlertaDeFormulario>
          </div>
        )}

        <Button type="submit" disabled={enviando} className="mt-6 w-full">
          {enviando ? 'Creando tu tienda…' : 'Crear mi tienda'}
        </Button>
      </form>
    </AuthShell>
  );
}
