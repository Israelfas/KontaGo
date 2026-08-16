'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { token, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !token) {
      router.replace('/login');
    }
  }, [cargando, token, router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-papel">
        <p className="font-ticket text-sm text-tinta-suave">Verificando sesión…</p>
      </div>
    );
  }

  if (!token) {
    return null; // el useEffect ya está redirigiendo
  }

  return <>{children}</>;
}
