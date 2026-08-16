'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth-context';
import { buscarPorCodigoBarras, crearVenta, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { Producto, Venta } from '@/lib/tipos';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

function ContenidoVenta() {
  const { token } = useAuth();
  const [codigoInput, setCodigoInput] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [montoRecibido, setMontoRecibido] = useState('');
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<Venta | null>(null);

  const inputCodigoRef = useRef<HTMLInputElement>(null);

  const totalCentavos = carrito.reduce(
    (acc, item) => acc + item.producto.precioVentaCentavos * item.cantidad,
    0,
  );
  const montoRecibidoCentavos = montoRecibido
    ? Math.round(parseFloat(montoRecibido) * 100)
    : null;
  const vueltoCentavos =
    montoRecibidoCentavos !== null ? montoRecibidoCentavos - totalCentavos : null;

  async function buscarYAgregar(codigo: string) {
    if (!token || !codigo.trim()) return;
    setErrorBusqueda(null);
    setBuscando(true);
    try {
      const producto = await buscarPorCodigoBarras(token, codigo.trim());
      if (!producto) {
        setErrorBusqueda(`No se encontró ningún producto con el código "${codigo}"`);
        return;
      }
      setCarrito((prev) => {
        const existente = prev.find((i) => i.producto.id === producto.id);
        if (existente) {
          return prev.map((i) =>
            i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
          );
        }
        return [...prev, { producto, cantidad: 1 }];
      });
      setCodigoInput('');
    } catch (err) {
      setErrorBusqueda(
        err instanceof ApiError ? err.message : 'No se pudo buscar el producto',
      );
    } finally {
      setBuscando(false);
      inputCodigoRef.current?.focus();
    }
  }

  function manejarSubmitBusqueda(e: FormEvent) {
    e.preventDefault();
    buscarYAgregar(codigoInput);
  }

  // Los lectores de código de barras "escriben" el código y mandan un
  // Enter automático — el submit del form ya cubre ese caso, pero dejamos
  // el handler de teclado explícito por si el input queda embebido en
  // algo que no dispare submit.
  function manejarTecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarYAgregar(codigoInput);
    }
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.producto.id === productoId
            ? { ...i, cantidad: i.cantidad + delta }
            : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((prev) => prev.filter((i) => i.producto.id !== productoId));
  }

  async function confirmarVenta() {
    if (!token || carrito.length === 0 || montoRecibidoCentavos === null) return;
    setErrorVenta(null);
    setProcesando(true);
    try {
      const venta = await crearVenta(token, {
        items: carrito.map((i) => ({
          productoId: i.producto.id,
          cantidad: i.cantidad,
        })),
        montoRecibidoCentavos,
      });
      setVentaConfirmada(venta);
      setCarrito([]);
      setMontoRecibido('');
    } catch (err) {
      setErrorVenta(err instanceof ApiError ? err.message : 'No se pudo registrar la venta');
    } finally {
      setProcesando(false);
    }
  }

  function nuevaVenta() {
    setVentaConfirmada(null);
    inputCodigoRef.current?.focus();
  }

  // --- Pantalla de confirmación ---
  if (ventaConfirmada) {
    return (
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="rounded-lg border border-verde-ganancia/30 bg-verde-ganancia/5 p-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-verde-ganancia">
            Venta registrada
          </p>
          <p className="mt-2 font-ticket text-3xl font-semibold text-tinta">
            {formatearCentavos(ventaConfirmada.totalCentavos)}
          </p>
          <div className="borde-perforado my-4" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-tinta-suave">Recibido</span>
            <span className="font-ticket text-tinta">
              {formatearCentavos(ventaConfirmada.montoRecibidoCentavos)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="font-medium text-tinta">Vuelto</span>
            <span className="font-ticket text-lg font-semibold text-ambar">
              {formatearCentavos(ventaConfirmada.vueltoCentavos)}
            </span>
          </div>
        </div>
        <button
          onClick={nuevaVenta}
          className="mt-6 w-full rounded-md bg-tinta py-2.5 text-sm font-medium text-papel transition-opacity hover:opacity-90"
        >
          Nueva venta
        </button>
      </div>
    );
  }

  // --- Pantalla de armado del carrito ---
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">
        Vender
      </h1>

      <form onSubmit={manejarSubmitBusqueda} className="mt-6">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
          Código de barras
        </label>
        <div className="flex gap-2">
          <input
            ref={inputCodigoRef}
            autoFocus
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            onKeyDown={manejarTecla}
            className="flex-1 rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
            placeholder="Escaneá o tipeá el código y presioná Enter"
          />
          <button
            type="submit"
            disabled={buscando}
            className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
        {errorBusqueda && (
          <p className="mt-2 text-sm text-rojo-perdida">{errorBusqueda}</p>
        )}
      </form>

      {carrito.length === 0 ? (
        <p className="mt-8 text-sm text-tinta-suave">
          El carrito está vacío. Buscá un producto por su código de barras
          para empezar.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-papel-linea">
          <table className="w-full text-left text-sm">
            <thead className="bg-papel-linea/40 text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 text-center font-medium">Cant.</th>
                <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {carrito.map((item) => (
                <tr key={item.producto.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">{item.producto.nombre}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => cambiarCantidad(item.producto.id, -1)}
                        className="h-6 w-6 rounded border border-papel-linea text-tinta-suave hover:bg-papel-linea/60"
                        aria-label="Restar"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-ticket text-tinta">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => cambiarCantidad(item.producto.id, 1)}
                        className="h-6 w-6 rounded border border-papel-linea text-tinta-suave hover:bg-papel-linea/60"
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-ticket text-tinta">
                    {formatearCentavos(
                      item.producto.precioVentaCentavos * item.cantidad,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => quitarDelCarrito(item.producto.id)}
                      className="text-xs text-rojo-perdida hover:underline"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-papel-linea bg-white/60 p-5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-tinta">Total</span>
              <span className="font-ticket text-xl font-semibold text-tinta">
                {formatearCentavos(totalCentavos)}
              </span>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
                Monto recibido
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
                placeholder="0.00"
              />
            </div>

            {vueltoCentavos !== null && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-tinta-suave">
                  {vueltoCentavos >= 0 ? 'Vuelto' : 'Falta'}
                </span>
                <span
                  className={`font-ticket font-semibold ${
                    vueltoCentavos >= 0 ? 'text-ambar' : 'text-rojo-perdida'
                  }`}
                >
                  {formatearCentavos(Math.abs(vueltoCentavos))}
                </span>
              </div>
            )}

            {errorVenta && (
              <p className="mt-3 rounded-md bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
                {errorVenta}
              </p>
            )}

            <button
              onClick={confirmarVenta}
              disabled={
                procesando ||
                montoRecibidoCentavos === null ||
                vueltoCentavos === null ||
                vueltoCentavos < 0
              }
              className="mt-4 w-full rounded-md bg-verde-ganancia py-2.5 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {procesando ? 'Confirmando…' : 'Confirmar venta'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VentaPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoVenta />
    </RutaProtegida>
  );
}