'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { token, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    router.replace(token ? '/dashboard' : '/login');
  }, [cargando, token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel">
      <p className="font-ticket text-sm text-tinta-suave">Cargando…</p>
    </div>
  );
}
