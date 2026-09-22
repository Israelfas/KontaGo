'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Página técnica: Clerk redirige acá después de que Google confirma la
// identidad, y este componente termina de armar la sesión de Clerk del
// lado del cliente. Cuando termina, redirige solo a "redirectUrlComplete"
// (ver login/page.tsx) — nadie ve esta pantalla más de un instante.
export default function SsoCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}