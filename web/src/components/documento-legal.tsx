import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppLogo } from './ui';

export const CORREO_SOPORTE = process.env.NEXT_PUBLIC_SOPORTE_CORREO?.trim() || null;

/** Página pública de un documento legal (términos, privacidad). */
export function DocumentoLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-papel px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" aria-label="Ir a KontaGo">
          <AppLogo />
        </Link>
        <article className="app-card mt-6 p-6 sm:p-9">
          <p className="eyebrow">Última actualización: {actualizado}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.05em] text-tinta">
            {titulo}
          </h1>
          <p className="mt-4 rounded-xl border border-ambar/30 bg-ambar/10 px-4 py-3 text-xs leading-5 text-[#8a5208]">
            Plantilla de referencia, no un documento legal terminado: antes de abrir KontaGo al
            público tiene que revisarla un abogado y ajustarla al negocio real.
          </p>
          <div className="documento-legal mt-6">{children}</div>
        </article>
        <p className="mt-6 text-center text-sm text-tinta-suave">
          <Link href="/terminos" className="underline hover:text-tinta">
            Términos
          </Link>
          {' · '}
          <Link href="/privacidad" className="underline hover:text-tinta">
            Privacidad
          </Link>
          {' · '}
          <Link href="/login" className="underline hover:text-tinta">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

export function Contacto() {
  return CORREO_SOPORTE ? (
    <a href={`mailto:${CORREO_SOPORTE}`} className="font-semibold underline">
      {CORREO_SOPORTE}
    </a>
  ) : (
    <>el correo de soporte que figura en la app</>
  );
}
