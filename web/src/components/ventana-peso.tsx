'use client';

import { useState, type FormEvent } from 'react';
import { Button } from './ui';
import { Ventana, VentanaPie } from './ventana';
import { formatearCentavos } from '@/lib/formato';
import {
  formatearCantidad,
  importeCentavos,
  leerCantidad,
  precioPor,
  redondear,
} from '@/lib/cantidad';
import type { Producto } from '@/lib/tipos';

// Lo que más se pide en una tienda: un cuarto, media, una, dos.
const RAPIDAS = [0.25, 0.5, 1, 2];

/**
 * Cuánto se lleva de algo que va por peso: con un toque (media libra), el
 * peso exacto de la balanza, o por cuánto dinero ("un dólar de queso").
 */
export function VentanaPeso({
  producto,
  inicial,
  maximo,
  onListo,
  onCerrar,
}: {
  producto: Producto;
  // Cambiando lo que ya está en el carrito.
  inicial?: number;
  // Sin conexión: lo que queda según el último stock guardado.
  maximo?: number;
  onListo: (cantidad: number) => void;
  onCerrar: () => void;
}) {
  const unidad = producto.unidad === 'kilo' ? 'kilo' : 'libra';
  const corta = unidad === 'kilo' ? 'kg' : 'lb';
  const [texto, setTexto] = useState(inicial !== undefined ? String(inicial) : '');
  const [dinero, setDinero] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Por dinero: la cantidad que alcanza con ese monto.
  const centavos = dinero.trim() ? Math.round(parseFloat(dinero.replace(',', '.')) * 100) : NaN;
  const porDinero =
    Number.isFinite(centavos) && centavos > 0 && producto.precioVentaCentavos > 0
      ? redondear(centavos / producto.precioVentaCentavos)
      : null;
  const cantidad = porDinero ?? leerCantidad(texto, unidad);

  function elegir(valor: number | null) {
    if (valor === null || valor <= 0) {
      setError(`Pon cuánto: por ejemplo 0,5 (media ${unidad}) o 1,25.`);
      return;
    }
    if (maximo !== undefined && valor > maximo) {
      setError(
        maximo <= 0
          ? `Según el último stock guardado, no queda ${producto.nombre}.`
          : `Según el último stock guardado, quedan ${formatearCantidad(maximo, unidad)}.`,
      );
      return;
    }
    onListo(valor);
  }

  function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    elegir(cantidad);
  }

  return (
    <Ventana
      titulo={`¿Cuánto de ${producto.nombre}?`}
      descripcion={`${formatearCentavos(producto.precioVentaCentavos)}${precioPor(unidad)}`}
      onCerrar={onCerrar}
    >
      <form onSubmit={manejarSubmit}>
        <div className="grid grid-cols-4 gap-2" aria-label="Cantidades rápidas">
          {RAPIDAS.map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => elegir(valor)}
              className="rounded-xl border border-papel-linea bg-white px-2 py-3 text-center transition-colors hover:border-tinta"
            >
              <span className="block font-ticket text-sm font-semibold text-tinta">
                {formatearCantidad(valor, unidad)}
              </span>
              <span className="block font-ticket text-xs text-tinta-suave">
                {formatearCentavos(importeCentavos(producto.precioVentaCentavos, valor))}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="peso-cantidad">
              Cantidad ({corta})
            </label>
            <input
              id="peso-cantidad"
              autoFocus
              inputMode="decimal"
              value={porDinero !== null ? String(porDinero) : texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setDinero('');
                setError(null);
              }}
              className="field font-ticket !mb-0"
              placeholder="0,5"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="peso-dinero">
              O por dinero ($)
            </label>
            <input
              id="peso-dinero"
              inputMode="decimal"
              value={dinero}
              onChange={(e) => {
                setDinero(e.target.value);
                setError(null);
              }}
              className="field font-ticket !mb-0"
              placeholder="1.00"
            />
          </div>
        </div>

        {cantidad !== null && cantidad > 0 && (
          <p className="mt-3 text-sm text-tinta" aria-live="polite">
            {formatearCantidad(cantidad, unidad)} ·{' '}
            <strong className="font-ticket">
              {formatearCentavos(importeCentavos(producto.precioVentaCentavos, cantidad))}
            </strong>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-rojo-perdida">
            {error}
          </p>
        )}

        <VentanaPie>
          <Button type="submit" variant="primary">
            {inicial !== undefined ? 'Cambiar' : 'Agregar'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </VentanaPie>
      </form>
    </Ventana>
  );
}
