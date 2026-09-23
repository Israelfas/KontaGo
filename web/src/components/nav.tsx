'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rutaInicial, useAuth } from '@/lib/auth-context';
import { obtenerAlertas, obtenerPerfil } from '@/lib/api';
import { BoxIcon, CartIcon, DashboardIcon, InventoryIcon, ReceiptIcon, UsersIcon } from './icons';
import { AppLogo } from './ui';

// soloAdmin: el cajero vende, ve las ventas del día y consulta el catálogo;
// resumen (ganancias), inventario y equipo son del dueño.
const ENLACES = [
  { href: '/venta', etiqueta: 'Vender', icono: CartIcon, soloAdmin: false },
  { href: '/ventas', etiqueta: 'Ventas', icono: ReceiptIcon, soloAdmin: false },
  {
    href: '/dashboard',
    etiqueta: 'Resumen',
    icono: DashboardIcon,
    soloAdmin: true,
  },
  {
    href: '/productos',
    etiqueta: 'Productos',
    icono: BoxIcon,
    soloAdmin: false,
  },
  {
    href: '/inventario',
    etiqueta: 'Inventario',
    icono: InventoryIcon,
    soloAdmin: true,
  },
  { href: '/equipo', etiqueta: 'Equipo', icono: UsersIcon, soloAdmin: true },
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
  // Sin esto, todas las tiendas se veían iguales: con dos cuentas no
  // había forma de saber en cuál estabas (y una tienda sin ventas parecía
  // un error).
  const [tienda, setTienda] = useState<string | null>(null);
  const esAdmin = usuario?.rol === 'admin';

  useEffect(() => {
    if (!token) return;
    obtenerPerfil(token)
      .then((perfil) => setTienda(perfil.tienda))
      .catch(() => setTienda(null));
  }, [token]);

  useEffect(() => {
    // El badge vive en Inventario, que el cajero no ve.
    if (!token || !esAdmin) return;
    // El nav se monta en todas las pantallas protegidas, así que este es
    // un buen lugar único para chequear alertas de vencimiento sin
    // depender de que el usuario entre a /inventario. Si falla, no
    // rompemos la navegación por un badge — solo lo dejamos en 0.
    obtenerAlertas(token)
      // Productos con algo por vencer o ya vencido (sin contar dos veces
      // uno que tenga las dos cosas).
      .then((alertas) =>
        setPorVencer(new Set([...alertas.porVencer, ...alertas.vencidos].map((p) => p.id)).size),
      )
      .catch(() => setPorVencer(0));
  }, [token, esAdmin]);

  const enlaces = ENLACES.filter((enlace) => esAdmin || !enlace.soloAdmin).map(
    ({ href, etiqueta, icono }) => ({
      href,
      etiqueta,
      icono,
      badge: href === '/inventario' ? porVencer : undefined,
    }),
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-papel-linea/80 bg-papel/90 backdrop-blur-xl">
        <div className="app-container">
          <div className="flex h-[72px] items-center justify-between gap-4">
            <Link href={rutaInicial(usuario?.rol)} aria-label="Ir al inicio de KontaGo">
              <AppLogo />
            </Link>

            <nav className="hidden items-center gap-1 rounded-xl border border-papel-linea/80 bg-white/45 p-1 md:flex">
              {enlaces.map((enlace) => (
                <EnlaceNavegacion key={enlace.href} {...enlace} activo={pathname === enlace.href} />
              ))}
            </nav>

            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {tienda && (
                <span
                  className="max-w-[7.5rem] truncate text-sm font-semibold text-tinta sm:max-w-[14rem]"
                  title={tienda}
                >
                  {tienda}
                </span>
              )}
              {usuario && (
                <span className="inline-flex rounded-full bg-ambar/15 px-2.5 py-1 font-ticket text-[0.65rem] font-semibold uppercase tracking-wider text-[#9a5b08]">
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
        </div>
      </header>

      {/* Fuera del <header>: su backdrop-filter convierte al header en el
          contenedor de los hijos con position: fixed, y la barra "inferior"
          aparecía pegada arriba, tapando el logo. */}
      {/* Celular: barra inferior fija con todas las secciones a la vista.
          Antes era una fila con scroll lateral en la que las últimas
          quedaban cortadas sin ninguna pista de que existían. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-papel-linea bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${enlaces.length}, minmax(0, 1fr))`,
          }}
        >
          {enlaces.map(({ href, etiqueta, icono: Icono, badge }) => {
            const activo = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[0.65rem] font-semibold ${
                  activo ? 'text-tinta' : 'text-tinta-suave'
                }`}
              >
                {activo && (
                  <span
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-ambar"
                    aria-hidden="true"
                  />
                )}
                <Icono className="h-5 w-5" />
                <span className="w-full truncate text-center">{etiqueta}</span>
                {!!badge && (
                  <span className="absolute right-[22%] top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rojo-perdida px-1 font-ticket text-[0.6rem] text-papel">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
