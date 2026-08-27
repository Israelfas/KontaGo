'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState, MetricCard, PageHeader } from '@/components/ui';
import { CartIcon, ReceiptIcon, SparklesIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { obtenerResumenDelDia, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { ResumenDelDia } from '@/lib/tipos';

function ContenidoDashboard() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<ResumenDelDia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    if (!token) return;
    setCargando(true);
    setError(null);
    obtenerResumenDelDia(token)
      .then(setResumen)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen'),
      )
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fechaLegible = resumen
    ? new Date(resumen.fecha + 'T00:00:00').toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : undefined;
  const margenPorcentaje =
    resumen && resumen.ingresoBrutoCentavos > 0
      ? Math.round((resumen.gananciaCentavos / resumen.ingresoBrutoCentavos) * 100)
      : 0;

  return (
    <div className="app-page">
      <div className="app-container">
        <PageHeader
          eyebrow="Cierre del día"
          title="Resumen del día"
          description={fechaLegible ? fechaLegible[0].toUpperCase() + fechaLegible.slice(1) : undefined}
        />

        <div className="mt-8">
          {cargando && <LoadingState label="Cargando resumen…" />}

          {error && !cargando && (
            <ErrorState action={<Button variant="secondary" onClick={cargar}>Reintentar</Button>}>
              {error}
            </ErrorState>
          )}

          {resumen && !cargando && !error && (
            <div className="space-y-8">
              <section className="dashboard-hero" aria-label="Desempeño del día">
                <div className="dashboard-hero-copy">
                  <span className="dashboard-hero-kicker">
                    <SparklesIcon className="h-4 w-4" />
                    Pulso de la tienda
                  </span>
                  <p className="dashboard-hero-label">Ganancia real acumulada</p>
                  <p className="dashboard-hero-value">
                    {formatearCentavos(resumen.gananciaCentavos)}
                  </p>
                  <p className="dashboard-hero-description">
                    {resumen.cantidadVentas > 0
                      ? `Tu margen representa el ${margenPorcentaje}% de lo vendido hoy.`
                      : 'Empezá una venta para ver el desempeño de tu día.'}
                  </p>
                  <Link href="/venta" className="button button-primary dashboard-hero-action">
                    <CartIcon className="h-4 w-4" />
                    Ir a vender
                  </Link>
                </div>

                <div className="dashboard-hero-summary">
                  <div className="dashboard-hero-ring" aria-hidden="true">
                    <span>{margenPorcentaje}%</span>
                    <small>margen</small>
                  </div>
                  <div className="dashboard-hero-summary-copy">
                    <span>Ingreso bruto</span>
                    <strong>{formatearCentavos(resumen.ingresoBrutoCentavos)}</strong>
                    <span>
                      {resumen.cantidadVentas} venta{resumen.cantidadVentas === 1 ? '' : 's'}
                      {' '}registrada{resumen.cantidadVentas === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Ventas de hoy"
                  value={resumen.cantidadVentas}
                  icon={<ReceiptIcon className="h-5 w-5" />}
                />
                <MetricCard
                  label="Ingreso bruto"
                  value={formatearCentavos(resumen.ingresoBrutoCentavos)}
                />
                <MetricCard
                  label="Ganancia real"
                  value={formatearCentavos(resumen.gananciaCentavos)}
                  icon={<SparklesIcon className="h-5 w-5" />}
                  tone="success"
                />
              </div>

              <div className="dashboard-nota">
                <ReceiptIcon className="h-4 w-4 shrink-0 text-ambar" />
                <p>
                  La ganancia es el margen (venta − costo) de cada producto vendido, no el
                  ingreso bruto.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
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
