'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { obtenerAlertas } from '@/lib/api';
import { BoxIcon, CartIcon, DashboardIcon, InventoryIcon } from './icons';
import { AppLogo } from './ui';

const ENLACES = [
  { href: '/venta', etiqueta: 'Vender', icono: CartIcon },
  { href: '/dashboard', etiqueta: 'Resumen', icono: DashboardIcon },
  { href: '/productos', etiqueta: 'Productos', icono: BoxIcon },
  { href: '/inventario', etiqueta: 'Inventario', icono: InventoryIcon },
];

function EnlaceNavegacion({
  href,
  etiqueta,
  activo,
  icono: Icono,
  badge,
}: {
  href: string;
  etiqueta: string;
  activo: boolean;
  icono: typeof CartIcon;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
        activo
          ? 'bg-tinta text-papel shadow-[0_4px_12px_rgba(28,43,58,0.16)]'
          : 'text-tinta-suave hover:bg-white/75 hover:text-tinta'
      }`}
    >
      <Icono className="h-4 w-4" />
      {etiqueta}
      {!!badge && (
        <span
          className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-ticket text-[0.6rem] font-semibold ${
            activo ? 'bg-papel text-tinta' : 'bg-rojo-perdida text-papel'
          }`}
          title={`${badge} producto${badge === 1 ? '' : 's'} por vencer`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { usuario, token, cerrarSesion } = useAuth();
  const [porVencer, setPorVencer] = useState(0);

  useEffect(() => {
    if (!token) return;
    // El nav se monta en todas las pantallas protegidas, así que este es
    // un buen lugar único para chequear alertas de vencimiento sin
    // depender de que el usuario entre a /inventario. Si falla, no
    // rompemos la navegación por un badge — solo lo dejamos en 0.
    obtenerAlertas(token)
      .then((alertas) => setPorVencer(alertas.porVencer.length))
      .catch(() => setPorVencer(0));
  }, [token]);

  const enlaces = ENLACES.map((enlace) => ({
    ...enlace,
    badge: enlace.href === '/inventario' ? porVencer : undefined,
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-papel-linea/80 bg-papel/90 backdrop-blur-xl">
      <div className="app-container">
        <div className="flex h-[72px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="Ir al resumen de KontaGo">
            <AppLogo />
          </Link>

          <nav className="hidden items-center gap-1 rounded-xl border border-papel-linea/80 bg-white/45 p-1 md:flex">
            {enlaces.map((enlace) => (
              <EnlaceNavegacion
                key={enlace.href}
                {...enlace}
                activo={pathname === enlace.href}
              />
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {usuario && (
              <span className="hidden rounded-full bg-ambar/15 px-2.5 py-1 font-ticket text-[0.65rem] font-semibold uppercase tracking-wider text-[#9a5b08] sm:inline-flex">
                {usuario.rol}
              </span>
            )}
            <button
              type="button"
              onClick={cerrarSesion}
              className="button button-ghost min-h-0 px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto border-t border-papel-linea/60 py-2 md:hidden">
          {enlaces.map((enlace) => (
            <EnlaceNavegacion
              key={enlace.href}
              {...enlace}
              activo={pathname === enlace.href}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}

