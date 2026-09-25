'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError, descargarReporteExcel, type RangoDeFechas } from '@/lib/api';
import { DownloadIcon } from './icons';

/**
 * Baja el reporte del período en Excel (ventas, productos vendidos, caja,
 * compras y mermas, stock) para pasárselo al contador. Va en la franja
 * oscura, al lado de la acción principal.
 */
export function BotonExcel({ periodo }: { periodo: RangoDeFechas }) {
  const { token } = useAuth();
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El aviso de error se va solo.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

  async function bajar() {
    if (!token || bajando) return;
    setBajando(true);
    setError(null);
    try {
      const { archivo, nombre } = await descargarReporteExcel(token, periodo);
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Un momento después: algunos navegadores leen la URL tras el clic.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo preparar el Excel.');
    } finally {
      setBajando(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={bajar}
        disabled={bajando}
        aria-busy={bajando}
        className="button button-sobre-oscuro"
        title="Ventas, caja e inventario del período, para tu contador"
      >
        <DownloadIcon className="h-4 w-4" />
        {bajando ? 'Preparando…' : 'Excel'}
      </button>
      {error && (
        <p
          role="alert"
          className="entra absolute right-0 top-full z-10 mt-2 w-60 rounded-xl bg-papel px-3 py-2 text-xs text-rojo-perdida shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  );
}
