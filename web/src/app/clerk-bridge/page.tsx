'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { ErrorState, LoadingState } from '@/components/ui';
import { PasoCodigo } from '@/components/paso-codigo';

// Clerk ya armó su propia sesión (ver sso-callback). Acá se toma el
// token de ESA sesión y se lo cambia por un token propio de KontaGo
// (mismo formato que un login normal) — de ahí en más, el resto de la
// app no sabe ni le importa que el login pasó por Clerk.
export default function ClerkBridgePage() {
  const { getToken, isLoaded } = useClerkAuth();
  const { completarLoginConClerk } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Entró con Google, pero la cuenta pide además el código de dos pasos.
  const [desafio, setDesafio] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) {
          setError('No se pudo obtener la sesión de Google. Prueba iniciar sesión de nuevo.');
          return;
        }
        const pendiente = await completarLoginConClerk(clerkToken);
        if (pendiente) setDesafio(pendiente.desafio);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo completar el login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (desafio) {
    return (
      <AuthShell
        eyebrow="Verificación en dos pasos"
        title="Un paso más"
        description="Tu cuenta está protegida con un código además de Google."
        footer={null}
      >
        <PasoCodigo desafio={desafio} onVolver={() => router.push('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Un momento"
      title="Completando tu ingreso…"
      description="Estamos confirmando tu cuenta, esto toma solo un segundo."
      footer={null}
    >
      {error ? (
        <div className="app-card p-5 sm:p-6">
          <ErrorState>{error}</ErrorState>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-sm font-semibold text-tinta underline"
          >
            Volver a intentar
          </button>
        </div>
      ) : (
        <LoadingState label="Confirmando tu cuenta…" />
      )}
    </AuthShell>
  );
}
