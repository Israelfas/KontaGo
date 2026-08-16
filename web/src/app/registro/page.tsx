'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function RegistroPage() {
  const { registrarse } = useAuth();
  const [nombreTienda, setNombreTienda] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registrarse({ nombreTienda, nombreAdmin, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar el registro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">
            Registrá tu tienda
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Vas a quedar como administrador de la cuenta.
          </p>
        </div>

        <form
          onSubmit={manejarSubmit}
          className="rounded-lg border border-papel-linea bg-white/50 p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
                Nombre de la tienda
              </label>
              <input
                required
                value={nombreTienda}
                onChange={(e) => setNombreTienda(e.target.value)}
                className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Mini Market El Sol"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
                Tu nombre
              </label>
              <input
                required
                value={nombreAdmin}
                onChange={(e) => setNombreAdmin(e.target.value)}
                className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
                placeholder="admin@tutienda.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 w-full rounded-md bg-tinta py-2.5 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? 'Creando tienda…' : 'Crear mi tienda'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-tinta-suave">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium text-tinta underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
