import type { ReactNode } from 'react';
import { CheckIcon, ReceiptIcon, SparklesIcon } from './icons';
import { AppLogo } from './ui';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-papel p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[1.5rem] border border-papel-linea bg-[#fffdf8]/75 shadow-[0_24px_70px_rgba(28,43,58,0.12)] lg:grid-cols-[0.95fr_1.05fr] sm:min-h-[calc(100vh-2.5rem)]">
        <section className="relative hidden overflow-hidden bg-tinta p-10 text-papel lg:flex lg:flex-col">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ambar/25 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-verde-ganancia/30 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-papel/15 bg-papel/10 px-3 py-1.5 font-ticket text-[0.68rem] font-medium uppercase tracking-[0.14em] text-papel/80">
              <SparklesIcon className="h-3.5 w-3.5 text-ambar" />
              Tu caja, siempre lista
            </span>
            <h1 className="mt-8 max-w-md font-display text-5xl font-bold leading-[0.94] tracking-[-0.065em]">
              La operación diaria, bajo control.
            </h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-papel/70">
              Vendé, controlá tu stock y detectá lo importante antes de que se vuelva un problema.
            </p>
          </div>

          <div className="relative mt-auto rounded-2xl border border-papel/15 bg-papel/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ambar text-tinta">
                <ReceiptIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold">Hecho para el ritmo de tu tienda</p>
                <p className="mt-0.5 text-sm text-papel/65">Simple en caja. Claro en decisiones.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 border-t border-papel/15 pt-4 text-sm text-papel/80">
              {['Ventas ágiles desde el celular', 'Stock y alertas en un mismo lugar'].map(
                (beneficio) => (
                  <span key={beneficio} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-ambar" />
                    {beneficio}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-full items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <AppLogo />
            </div>
            <p className="eyebrow mt-8 lg:mt-0">{eyebrow}</p>
            <h2 className="font-display text-3xl font-bold tracking-[-0.055em] text-tinta sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-tinta-suave">{description}</p>

            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-sm text-tinta-suave">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
