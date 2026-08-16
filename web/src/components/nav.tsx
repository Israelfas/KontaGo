'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const ENLACES = [
  { href: '/dashboard', etiqueta: 'Resumen del día' },
  { href: '/productos', etiqueta: 'Productos' },
];

export function Nav() {
  const pathname = usePathname();
  const { usuario, cerrarSesion } = useAuth();

  return (
    <header className="border-b border-papel-linea bg-papel">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-tinta">
            Konta<span className="text-ambar">Go</span>
          </span>
          <nav className="flex gap-1">
            {ENLACES.map((enlace) => {
              const activo = pathname === enlace.href;
              return (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activo
                      ? 'bg-tinta text-papel'
                      : 'text-tinta-suave hover:bg-papel-linea/60'
                  }`}
                >
                  {enlace.etiqueta}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {usuario && (
            <span className="font-ticket text-xs text-tinta-suave uppercase tracking-wide">
              {usuario.rol}
            </span>
          )}
          <button
            onClick={cerrarSesion}
            className="rounded-md px-3 py-1.5 text-sm text-tinta-suave transition-colors hover:bg-papel-linea/60"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
