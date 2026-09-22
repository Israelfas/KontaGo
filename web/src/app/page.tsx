'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rutaInicial, useAuth } from '@/lib/auth-context';

export default function Home() {
  const { token, usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    router.replace(token ? rutaInicial(usuario?.rol) : '/login');
  }, [cargando, token, usuario?.rol, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel">
      <p className="font-ticket text-sm text-tinta-suave">Cargando…</p>
    </div>
  );
}
