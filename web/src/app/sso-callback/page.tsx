'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Página técnica: Clerk redirige acá después de que Google confirma la
// identidad, y este componente termina de armar la sesión de Clerk del
// lado del cliente. Nadie la ve más de un instante.
//
// Los "force" mandan SIEMPRE a /clerk-bridge (donde cambiamos la sesión
// de Clerk por un token propio de KontaGo), tanto si el flujo terminó en
// un inicio de sesión como si derivó en un alta (la primera vez que
// alguien entra con Google todavía no existe en Clerk).
//
// signInUrl/signUpUrl son el plan B: si la transacción se perdió y el
// flujo no puede continuar, se vuelve a nuestro login. Sin ellos, Clerk
// mandaba a su portal de cuentas (accounts.dev).
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl="/clerk-bridge"
      signUpForceRedirectUrl="/clerk-bridge"
      signInUrl="/login"
      signUpUrl="/registro"
    />
  );
}
