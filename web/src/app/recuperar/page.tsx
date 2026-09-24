'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { AlertaDeFormulario, AvisoDeCampo, Button } from '@/components/ui';
import { ApiError, pedirRecuperacion } from '@/lib/api';
import { problemaDelEmail } from '@/lib/validacion';

// Para no mandar varios emails seguidos por un doble toque o impaciencia.
const ESPERA_REENVIO_S = 60;

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [salioDelEmail, setSalioDelEmail] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const problemaEmail = problemaDelEmail(email);

  // Si viene del login con el email ya escrito, no hay que tipearlo de nuevo.
  useEffect(() => {
    const desdeLogin = new URLSearchParams(window.location.search).get('email');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (desdeLogin) setEmail(desdeLogin);
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const reloj = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(reloj);
  }, [espera]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (problemaEmail || !email.trim()) {
      setSalioDelEmail(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await pedirRecuperacion(email.trim());
      setEnviado(true);
      setEspera(ESPERA_REENVIO_S);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recuperar el acceso"
      title={enviado ? 'Revisa tu correo' : '¿Olvidaste tu contraseña?'}
      description={
        enviado
          ? 'Si el email tiene una cuenta en KontaGo, te llega un enlace para elegir una contraseña nueva.'
          : 'Escribe el email de tu cuenta y te mandamos un enlace para elegir una nueva.'
      }
      footer={
        <Link
          href="/login"
          className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
        >
          Volver a iniciar sesión
        </Link>
      }
    >
      {enviado ? (
        <div className="app-card entra p-5 sm:p-6" role="status">
          <p className="text-sm text-tinta">
            Lo mandamos a <strong className="break-all">{email.trim()}</strong>.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-tinta-suave">
            <li>· El enlace vence en 30 minutos y sirve una sola vez.</li>
            <li>· Si no aparece, revisa la carpeta de spam o promociones.</li>
            <li>· Si pediste varios, vale solo el último.</li>
          </ul>
          <Button
            type="button"
            variant="secondary"
            className="mt-5 w-full"
            disabled={espera > 0 || enviando}
            onClick={() => enviar()}
          >
            {espera > 0 ? `Reenviar en ${espera} s` : enviando ? 'Enviando…' : 'Reenviar el enlace'}
          </Button>
          <button
            type="button"
            onClick={() => setEnviado(false)}
            className="mt-3 w-full text-center text-xs font-medium text-tinta-suave underline hover:text-tinta"
          >
            Usar otro email
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="app-card p-5 sm:p-6" noValidate>
          <label className="field-label" htmlFor="recuperar-email">
            Email
          </label>
          <input
            id="recuperar-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setSalioDelEmail(true)}
            aria-invalid={salioDelEmail && !!problemaEmail}
            aria-describedby="recuperar-email-aviso"
            className="field"
            placeholder="admin@tutienda.com"
          />
          <AvisoDeCampo
            id="recuperar-email-aviso"
            error={
              salioDelEmail
                ? (problemaEmail ?? (email.trim() ? null : 'Escribe el email de tu cuenta.'))
                : null
            }
          />
          {error && (
            <div className="mt-3">
              <AlertaDeFormulario>{error}</AlertaDeFormulario>
            </div>
          )}
          <Button type="submit" disabled={enviando} className="mt-4 w-full">
            {enviando ? 'Enviando…' : 'Mandarme el enlace'}
          </Button>
          <p className="mt-4 text-xs leading-5 text-tinta-suave">
            ¿Eres cajero y no usas tu propio email? Pídele al administrador de tu tienda que te ponga
            una contraseña nueva desde Equipo.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
