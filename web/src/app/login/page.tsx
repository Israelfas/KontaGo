'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSignIn } from '@clerk/nextjs/legacy';
import { AuthShell } from '@/components/auth-shell';
import { AlertaDeFormulario, AvisoDeCampo, Button } from '@/components/ui';
import { CampoContrasena } from '@/components/campo-contrasena';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { problemaDelEmail } from '@/lib/validacion';

export default function LoginPage() {
  const { iniciarSesion } = useAuth();
  const { signIn, isLoaded: clerkListo } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conGoogle, setConGoogle] = useState(false);
  const [salioDelEmail, setSalioDelEmail] = useState(false);
  // Viene de elegir una contraseña nueva con el enlace del email.
  const [recienCambiada, setRecienCambiada] = useState(false);
  const problemaEmail = problemaDelEmail(email);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecienCambiada(new URLSearchParams(window.location.search).has('restablecida'));
  }, []);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (problemaEmail) {
      setSalioDelEmail(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  async function iniciarConGoogle() {
    if (!clerkListo) return;
    setError(null);
    setConGoogle(true);
    try {
      // Redirige a Google, Google vuelve a /sso-callback (donde Clerk
      // termina de armar su sesión), y de ahí a /clerk-bridge (donde
      // cambiamos esa sesión de Clerk por un token propio de KontaGo).
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/clerk-bridge',
      });
    } catch {
      setError('No se pudo iniciar el login con Google. Probá de nuevo.');
      setConGoogle(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Bienvenido de vuelta"
      title="Entrá a tu operación"
      description="Todo lo que necesitás para atender, cobrar y controlar tu tienda en un solo lugar."
      footer={
        <>
          ¿Todavía no tenés tienda?{' '}
          <Link
            href="/registro"
            className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
          >
            Registrá tu negocio
          </Link>
        </>
      }
    >
      <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
        {recienCambiada && !error && (
          <p
            className="entra mb-4 rounded-xl border border-verde-ganancia/25 bg-verde-ganancia/[0.07] px-3.5 py-3 text-sm text-verde-ganancia"
            role="status"
          >
            Listo: tu contraseña cambió. Entrá con la nueva.
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              onBlur={() => setSalioDelEmail(true)}
              aria-invalid={salioDelEmail && !!problemaEmail}
              aria-describedby="email-aviso"
              className="field"
              placeholder="admin@tutienda.com"
            />
            <AvisoDeCampo id="email-aviso" error={salioDelEmail ? problemaEmail : null} />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label className="field-label" htmlFor="password">
                Contraseña
              </label>
              <Link
                href={
                  email && !problemaEmail
                    ? `/recuperar?email=${encodeURIComponent(email)}`
                    : '/recuperar'
                }
                className="text-xs font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <CampoContrasena
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <AlertaDeFormulario>{error}</AlertaDeFormulario>
          </div>
        )}

        <Button type="submit" disabled={enviando} className="mt-6 w-full">
          {enviando ? 'Ingresando…' : 'Ingresar a KontaGo'}
        </Button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-papel-linea" />
          <span className="text-xs text-tinta-suave">o</span>
          <div className="h-px flex-1 bg-papel-linea" />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={conGoogle}
          onClick={iniciarConGoogle}
          className="w-full"
        >
          {conGoogle ? 'Redirigiendo…' : 'Continuar con Google'}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-tinta-suave">
          Si es tu primera vez, continuar con Google crea tu tienda y acepta los{' '}
          <Link href="/terminos" className="underline hover:text-tinta">
            términos
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" className="underline hover:text-tinta">
            política de privacidad
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
