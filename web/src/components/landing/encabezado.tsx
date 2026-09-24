'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { rutaInicial, useAuth } from '@/lib/auth-context';
import { AppLogo } from '../ui';
import { ArrowRightIcon } from '../icons';

const SECCIONES = [
  { href: '#producto', texto: 'Producto' },
  { href: '#como-funciona', texto: 'Cómo funciona' },
  { href: '#descargar', texto: 'Descargar' },
  { href: '#preguntas', texto: 'Preguntas' },
];

/**
 * Barra de arriba de la landing: transparente sobre el hero y, apenas se
 * scrollea, una capa de vidrio con el contenido pasando por debajo. Si ya
 * hay sesión, en vez de "Entrar" ofrece volver a la tienda.
 */
export function Encabezado() {
  const { token, usuario, cargando } = useAuth();
  const [scrolleado, setScrolleado] = useState(false);

  useEffect(() => {
    const revisar = () => setScrolleado(window.scrollY > 8);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);

  return (
    <header className="landing-encabezado" data-scrolleado={scrolleado}>
      <div className="app-container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="KontaGo, inicio" className="shrink-0">
          <AppLogo />
        </Link>

        <nav aria-label="Secciones de la página" className="hidden items-center gap-1 lg:flex">
          {SECCIONES.map((s) => (
            <a key={s.href} href={s.href} className="landing-enlace">
              {s.texto}
            </a>
          ))}
        </nav>

        {/* Hasta saber si hay sesión, invisible (sin saltos de un botón a otro). */}
        <div
          className="flex items-center gap-1.5 transition-opacity duration-300 sm:gap-2"
          style={{ opacity: cargando ? 0 : 1 }}
        >
          {token ? (
            <Link href={rutaInicial(usuario?.rol)} className="button button-primary">
              Ir a mi tienda
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="button button-ghost px-3">
                Entrar
              </Link>
              <Link href="/registro" className="button button-primary">
                {/* Un solo texto: el gap del botón separaría "gratis". */}
                <span>
                  Crear cuenta<span className="hidden sm:inline"> gratis</span>
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
