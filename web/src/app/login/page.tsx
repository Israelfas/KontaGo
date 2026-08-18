'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorState } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Bienvenido de vuelta"
      title="Entrá a tu operación"
      description="Todo lo que necesitás para atender, cobrar y controlar tu tienda en un solo lugar."
      footer={
        <>
          ¿Todavía no tenés tienda?{' '}
          <Link
            href="/registro"
            className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
          >
            Registrá tu negocio
          </Link>
        </>
      }
    >
      <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              className="field"
              placeholder="admin@tutienda.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              className="field"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorState>{error}</ErrorState>
          </div>
        )}

        <Button type="submit" disabled={enviando} className="mt-6 w-full">
          {enviando ? 'Ingresando…' : 'Ingresar a KontaGo'}
        </Button>
      </form>
    </AuthShell>
  );
}
