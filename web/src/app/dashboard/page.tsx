'use client';

import { useEffect, useState } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth-context';
import { obtenerResumenDelDia, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { ResumenDelDia } from '@/lib/tipos';

function ContenidoDashboard() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<ResumenDelDia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    obtenerResumenDelDia(token)
      .then(setResumen)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen'),
      )
      .finally(() => setCargando(false));
  }, [token]);

  const fechaLegible = resumen
    ? new Date(resumen.fecha + 'T00:00:00').toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">
        Resumen del día
      </h1>
      <p className="mt-1 text-sm text-tinta-suave capitalize">{fechaLegible}</p>

      {cargando && (
        <p className="mt-8 font-ticket text-sm text-tinta-suave">Cargando…</p>
      )}

      {error && (
        <p className="mt-8 rounded-md bg-rojo-perdida/10 px-4 py-3 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      {resumen && (
        <div className="mt-8 max-w-sm rounded-lg border border-papel-linea bg-white/60 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
              Ventas de hoy
            </span>
            <span className="font-ticket text-sm text-tinta">
              {resumen.cantidadVentas}
            </span>
          </div>

          <div className="borde-perforado my-4" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-tinta-suave">Ingreso bruto</span>
            <span className="font-ticket text-base text-tinta">
              {formatearCentavos(resumen.ingresoBrutoCentavos)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-tinta">Ganancia real</span>
            <span className="font-ticket text-xl font-semibold text-verde-ganancia">
              {formatearCentavos(resumen.gananciaCentavos)}
            </span>
          </div>

          <p className="mt-4 text-xs text-tinta-suave">
            La ganancia es el margen (venta − costo) de cada producto vendido,
            no el ingreso bruto.
          </p>
        </div>
      )}

      {resumen && resumen.cantidadVentas === 0 && (
        <p className="mt-4 text-sm text-tinta-suave">
          Todavía no registraste ninguna venta hoy.
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoDashboard />
    </RutaProtegida>
  );
}
