'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rutaInicial, useAuth } from '@/lib/auth-context';
import { obtenerAlertas, obtenerPerfil } from '@/lib/api';
import {
  BoxIcon,
  CartIcon,
  CashIcon,
  DashboardIcon,
  InventoryIcon,
  ReceiptIcon,
  UsersIcon,
} from './icons';
import { AppLogo } from './ui';
import { MenuCuenta } from './menu-cuenta';

// soloAdmin: el cajero vende, ve las ventas del día y consulta el catálogo;
// resumen (ganancias), inventario y equipo son del dueño.
const ENLACES = [
  { href: '/venta', etiqueta: 'Vender', icono: CartIcon, soloAdmin: false },
  { href: '/ventas', etiqueta: 'Ventas', icono: ReceiptIcon, soloAdmin: false },
  // Cada uno abre y cierra su caja; el admin además ve la de todos.
  { href: '/caja', etiqueta: 'Caja', icono: CashIcon, soloAdmin: false },
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

type Pastilla = { x: number; ancho: number };

// Cada pantalla monta su propio Nav. Lo que se recuerda de una a otra:
// - dónde iba la pastilla, para que siga viaje en vez de volver a empezar;
// - lo que llega del servidor (nombre de la tienda y contador de
//   Inventario): sin eso cada pantalla armaba el menú sin ellos, al llegar
//   cambiaba de ancho y todo el menú saltaba de costado.
const recuerdo = {
  usuario: null as string | null,
  tienda: null as string | null,
  nombre: null as string | null,
  email: null as string | null,
  porVencer: 0,
  pastilla: null as Pastilla | null,
  indiceInferior: null as number | null,
};

/** Posición real en pantalla de la pastilla, aunque esté a mitad de viaje. */
function dondeEsta(el: HTMLElement): Pastilla {
  return {
    x: new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
    ancho: el.getBoundingClientRect().width,
  };
}

/**
 * La pastilla oscura del menú. Sale hacia la sección apenas se hace clic
 * (no espera a que cargue la pantalla nueva) y, si la pantalla llega a
 * mitad de camino, sigue desde donde iba.
 */
function usePastilla(navRef: RefObject<HTMLElement | null>, clave: string) {
  const indicadorRef = useRef<HTMLSpanElement>(null);
  const [pastilla, setPastilla] = useState<(Pastilla & { animar: boolean }) | null>(() =>
    recuerdo.pastilla ? { ...recuerdo.pastilla, animar: false } : null,
  );

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // Registra la posición de partida: así el cambio se anima en vez de saltar.
    void nav.offsetWidth;
    const medir = (animar: boolean) => {
      const activo = nav.querySelector<HTMLElement>('[aria-current="page"]');
      recuerdo.pastilla = activo ? { x: activo.offsetLeft, ancho: activo.offsetWidth } : null;
      setPastilla(recuerdo.pastilla ? { ...recuerdo.pastilla, animar } : null);
    };
    const cuadro = requestAnimationFrame(() => medir(true));
    const alRedimensionar = () => medir(false);
    window.addEventListener('resize', alRedimensionar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [navRef, clave]);

  // Al desmontarse (cambio de pantalla), deja anotado dónde va de verdad.
  useLayoutEffect(
    () => () => {
      if (indicadorRef.current) recuerdo.pastilla = dondeEsta(indicadorRef.current);
    },
    [],
  );

  const irA = (enlace: HTMLElement) => {
    recuerdo.pastilla = { x: enlace.offsetLeft, ancho: enlace.offsetWidth };
    setPastilla({ ...recuerdo.pastilla, animar: true });
  };

  return { pastilla, indicadorRef, irA };
}

/** La rayita de la barra inferior: mismo criterio, con columnas iguales. */
function useIndiceInferior(actual: number) {
  const [estado, setEstado] = useState(() => ({
    indice: recuerdo.indiceInferior ?? actual,
    animar: false,
  }));

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      setEstado((previo) => ({ indice: actual, animar: previo.indice !== actual }));
      recuerdo.indiceInferior = actual;
    });
    return () => cancelAnimationFrame(cuadro);
  }, [actual]);

  const irA = (indice: number) => {
    recuerdo.indiceInferior = indice;
    setEstado({ indice, animar: true });
  };

  return { ...estado, irA };
}

// Un clic con Ctrl/Cmd/Shift o con la rueda abre otra pestaña: acá no cambia nada.
const abreOtraPestana = (e: MouseEvent) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

function EnlaceNavegacion({
  href,
  etiqueta,
  activo,
  conFondo,
  icono: Icono,
  badge,
  onElegir,
}: {
  href: string;
  etiqueta: string;
  activo: boolean;
  /** Fondo propio solo mientras la pastilla todavía no se ubicó. */
  conFondo: boolean;
  icono: typeof CartIcon;
  badge?: number;
  onElegir: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onElegir}
      aria-current={activo ? 'page' : undefined}
      className={`nav-enlace relative z-[1] inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color,transform] duration-[280ms] [transition-timing-function:var(--ease-deslizar)] ${
        activo
          ? `text-papel ${conFondo ? 'bg-tinta shadow-[0_4px_12px_rgba(28,43,58,0.16)]' : ''}`
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
  const { usuario, token } = useAuth();
  // Lo recordado vale solo para la misma cuenta.
  const mismaCuenta = !!usuario && recuerdo.usuario === usuario.sub;
  const [porVencer, setPorVencer] = useState(() => (mismaCuenta ? recuerdo.porVencer : 0));
  // Sin esto, todas las tiendas se veían iguales: con dos cuentas no
  // había forma de saber en cuál estabas (y una tienda sin ventas parecía
  // un error).
  const [tienda, setTienda] = useState<string | null>(() => (mismaCuenta ? recuerdo.tienda : null));
  // Quién está adentro, para el menú de la cuenta.
  const [cuenta, setCuenta] = useState(() => ({
    nombre: mismaCuenta ? recuerdo.nombre : null,
    email: mismaCuenta ? recuerdo.email : null,
  }));
  // Adónde se hizo clic, mientras la pantalla nueva todavía no llegó.
  const [elegido, setElegido] = useState<string | null>(null);
  const esAdmin = usuario?.rol === 'admin';
  const activa = elegido ?? pathname;

  useEffect(() => {
    if (!token || !usuario) return;
    const cuenta = usuario.sub;
    obtenerPerfil(token)
      .then((perfil) => {
        recuerdo.usuario = cuenta;
        recuerdo.tienda = perfil.tienda;
        recuerdo.nombre = perfil.nombre;
        recuerdo.email = perfil.email;
        setTienda(perfil.tienda);
        setCuenta({ nombre: perfil.nombre, email: perfil.email });
      })
      .catch(() => setTienda(null));
  }, [token, usuario]);

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
      .then((alertas) => {
        recuerdo.porVencer = new Set(
          [...alertas.porVencer, ...alertas.vencidos].map((p) => p.id),
        ).size;
        setPorVencer(recuerdo.porVencer);
      })
      .catch(() => setPorVencer(0));
  }, [token, esAdmin]);

  const navRef = useRef<HTMLElement>(null);
  const { pastilla, indicadorRef, irA } = usePastilla(
    navRef,
    `${pathname}|${porVencer}|${esAdmin}|${tienda}`,
  );

  const enlaces = ENLACES.filter((enlace) => esAdmin || !enlace.soloAdmin).map(
    ({ href, etiqueta, icono }) => ({
      href,
      etiqueta,
      icono,
      badge: href === '/inventario' ? porVencer : undefined,
    }),
  );

  const inferior = useIndiceInferior(enlaces.findIndex((e) => e.href === pathname));

  // La respuesta va en el clic: la pastilla y la rayita salen ya hacia la
  // sección elegida, sin esperar a que cargue la pantalla.
  const elegir = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (abreOtraPestana(e) || href === pathname) return;
    setElegido(href);
    irA(e.currentTarget);
    const indice = enlaces.findIndex((x) => x.href === href);
    if (indice >= 0) inferior.irA(indice);
  };

  return (
    <>
      <header className="vidrio sticky top-0 z-40 border-b border-papel-linea/80 bg-papel/90 backdrop-blur-xl">
        <div className="app-container">
          <div className="flex h-[72px] items-center justify-between gap-4">
            <Link href={rutaInicial(usuario?.rol)} aria-label="Ir al inicio de KontaGo">
              <AppLogo />
            </Link>

            <nav
              ref={navRef}
              className="relative hidden items-center gap-1 rounded-xl border border-papel-linea/80 bg-white/45 p-1 md:flex"
            >
              {pastilla && (
                <span
                  ref={indicadorRef}
                  aria-hidden="true"
                  className={`nav-indicador ${pastilla.animar ? 'nav-indicador-animado' : ''}`}
                  style={{ width: pastilla.ancho, transform: `translateX(${pastilla.x}px)` }}
                />
              )}
              {enlaces.map((enlace) => (
                <EnlaceNavegacion
                  key={enlace.href}
                  {...enlace}
                  activo={activa === enlace.href}
                  conFondo={!pastilla}
                  onElegir={(e) => elegir(e, enlace.href)}
                />
              ))}
            </nav>

            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {/* Para el admin, el nombre lleva a los datos de la tienda (los
                  del ticket): es donde uno lo busca. */}
              {tienda &&
                (esAdmin ? (
                  <Link
                    href="/tienda"
                    className="max-w-[7.5rem] truncate text-sm font-semibold text-tinta underline decoration-papel-linea decoration-2 underline-offset-4 hover:decoration-tinta sm:max-w-[14rem]"
                    title={`${tienda} · datos de la tienda`}
                  >
                    {tienda}
                  </Link>
                ) : (
                  <span
                    className="max-w-[7.5rem] truncate text-sm font-semibold text-tinta sm:max-w-[14rem]"
                    title={tienda}
                  >
                    {tienda}
                  </span>
                ))}
              <MenuCuenta nombre={cuenta.nombre} email={cuenta.email} rol={usuario?.rol} />
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
        className="vidrio fixed inset-x-0 bottom-0 z-40 border-t border-papel-linea bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${enlaces.length}, minmax(0, 1fr))`,
          }}
        >
          {inferior.indice >= 0 && (
            <span
              aria-hidden="true"
              className="barra-inferior-indicador"
              style={{
                width: `${100 / enlaces.length}%`,
                transform: `translateX(${inferior.indice * 100}%) scaleX(0.55)`,
                transition: inferior.animar ? 'transform 280ms var(--ease-deslizar)' : undefined,
              }}
            />
          )}
          {enlaces.map(({ href, etiqueta, icono: Icono, badge }) => {
            const activo = activa === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => elegir(e, href)}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[0.65rem] font-semibold ${
                  activo ? 'text-tinta' : 'text-tinta-suave'
                }`}
              >
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
