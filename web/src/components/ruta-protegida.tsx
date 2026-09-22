'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// soloAdmin: pantallas con información del dueño (resumen, inventario,
// equipo). El backend igual responde 403 a un cajero; esto evita que
// vea una pantalla rota y lo manda a vender.
export function RutaProtegida({
  children,
  soloAdmin = false,
}: {
  children: React.ReactNode;
  soloAdmin?: boolean;
}) {
  const { token, usuario, cargando } = useAuth();
  const bloqueado = soloAdmin && usuario?.rol !== 'admin';
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    if (!token) {
      router.replace('/login');
    } else if (bloqueado) {
      router.replace('/venta');
    }
  }, [cargando, token, bloqueado, router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-papel">
        <p className="font-ticket text-sm text-tinta-suave">Verificando sesión…</p>
      </div>
    );
  }

  if (!token || bloqueado) {
    return null; // el useEffect ya está redirigiendo
  }

  return <>{children}</>;
}
