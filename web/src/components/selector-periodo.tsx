'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { CalendarIcon } from '@/components/icons';
import {
  OPCIONES_PERIODO,
  busquedaDelPeriodo,
  hoyISO,
  periodoDeLaURL,
  periodoElegido,
  periodoPredefinido,
  problemaDelRango,
  rangoLegible,
  type Periodo,
} from '@/lib/periodo';

/**
 * El período elegido vive en la URL (?desde&hasta): se puede recargar,
 * volver atrás o pasar el link, y Resumen → Ventas mantiene el período.
 * Es null hasta leer la URL (en el servidor no hay URL que leer).
 */
export function usePeriodoDeLaURL(): [Periodo | null, (p: Periodo) => void] {
  const [periodo, setPeriodo] = useState<Periodo | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriodo(periodoDeLaURL(window.location.search));
  }, []);

  const cambiar = useCallback((p: Periodo) => {
    setPeriodo(p);
    window.history.replaceState(null, '', window.location.pathname + busquedaDelPeriodo(p));
  }, []);

  return [periodo, cambiar];
}

/** Botones de período para la franja oscura (va en el `extra` de Banda). */
export function SelectorPeriodo({
  periodo,
  onCambiar,
}: {
  periodo: Periodo;
  onCambiar: (p: Periodo) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [desde, setDesde] = useState(periodo.desde);
  const [hasta, setHasta] = useState(periodo.hasta);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyISO();

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const problema = problemaDelRango(desde, hasta);
    setError(problema);
    if (problema) return;
    onCambiar(periodoElegido(desde, hasta));
    setEligiendo(false);
  }

  return (
    <div>
      <div className="periodo" role="group" aria-label="Período">
        {OPCIONES_PERIODO.map((opcion) => (
          <button
            key={opcion.clave}
            type="button"
            className="chip-periodo"
            aria-pressed={periodo.clave === opcion.clave}
            onClick={() => {
              setEligiendo(false);
              setError(null);
              onCambiar(periodoPredefinido(opcion.clave));
            }}
          >
            {opcion.texto}
          </button>
        ))}
        <button
          type="button"
          className="chip-periodo inline-flex items-center gap-1.5"
          aria-pressed={periodo.clave === 'elegido'}
          aria-expanded={eligiendo}
          onClick={() => {
            setDesde(periodo.desde);
            setHasta(periodo.hasta);
            setError(null);
            setEligiendo((abierto) => !abierto);
          }}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {periodo.clave === 'elegido' ? rangoLegible(periodo) : 'Elegir fechas'}
        </button>
      </div>

      {eligiendo && (
        <form onSubmit={aplicar} className="periodo-rango">
          <label>
            Desde
            <input
              type="date"
              value={desde}
              max={hoy}
              required
              onChange={(e) => setDesde(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              max={hoy}
              required
              onChange={(e) => setHasta(e.target.value)}
            />
          </label>
          <Button type="submit" variant="claro">
            Ver
          </Button>
        </form>
      )}
      {error && (
        <p className="periodo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
