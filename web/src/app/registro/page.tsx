'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorState } from '@/components/ui';
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

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
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
    <AuthShell
      eyebrow="Creá tu espacio"
      title="Empezá con tu tienda"
      description="Configurá tu cuenta en unos minutos. Vas a quedar como administrador y podrás sumar a tu equipo después."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link
            href="/login"
            className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
          >
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="nombre-tienda">
              Nombre de la tienda
            </label>
            <input
              id="nombre-tienda"
              required
              value={nombreTienda}
              onChange={(evento) => setNombreTienda(evento.target.value)}
              className="field"
              placeholder="Mini Market El Sol"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="nombre-admin">
              Tu nombre
            </label>
            <input
              id="nombre-admin"
              autoComplete="name"
              required
              value={nombreAdmin}
              onChange={(evento) => setNombreAdmin(evento.target.value)}
              className="field"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="registro-email">
              Email
            </label>
            <input
              id="registro-email"
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
            <label className="field-label" htmlFor="registro-password">
              Contraseña
            </label>
            <input
              id="registro-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              className="field"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorState>{error}</ErrorState>
          </div>
        )}

        <Button type="submit" disabled={enviando} className="mt-6 w-full">
          {enviando ? 'Creando tu tienda…' : 'Crear mi tienda'}
        </Button>
      </form>
    </AuthShell>
  );
}
