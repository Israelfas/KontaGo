'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth-context';
import { listarProductos, crearProducto, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { Producto } from '@/lib/tipos';

function FormularioNuevoProducto({
  onCreado,
}: {
  onCreado: (p: Producto) => void;
}) {
  const { token } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      // Los inputs son pesos/dólares "humanos" (ej. 1500.50); el backend
      // espera centavos enteros (ver sección 6.3 del spec: nunca floats).
      const producto = await crearProducto(token, {
        codigoBarras,
        nombre,
        precioVentaCentavos: Math.round(parseFloat(precioVenta) * 100),
        costoUnitarioCentavos: costoUnitario
          ? Math.round(parseFloat(costoUnitario) * 100)
          : undefined,
        stockInicial: stockInicial ? parseInt(stockInicial, 10) : undefined,
      });
      onCreado(producto);
      setCodigoBarras('');
      setNombre('');
      setPrecioVenta('');
      setCostoUnitario('');
      setStockInicial('');
      setAbierto(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity hover:opacity-90"
      >
        + Nuevo producto
      </button>
    );
  }

  return (
    <form
      onSubmit={manejarSubmit}
      className="rounded-lg border border-papel-linea bg-white/60 p-5"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Código de barras
          </label>
          <input
            required
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
            placeholder="7791234567890"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Nombre
          </label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
            placeholder="Coca Cola 500ml"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Precio de venta
          </label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
            placeholder="1500.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Costo unitario
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
            placeholder="900.00"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Stock inicial
          </label>
          <input
            type="number"
            min="0"
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
            placeholder="20"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Guardando…' : 'Guardar producto'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md px-4 py-2 text-sm text-tinta-suave hover:bg-papel-linea/60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ContenidoProductos() {
  const { token } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listarProductos(token)
      .then(setProductos)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el inventario'),
      )
      .finally(() => setCargando(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">
          Productos
        </h1>
        <FormularioNuevoProducto
          onCreado={(p) => setProductos((prev) => [p, ...prev])}
        />
      </div>

      {cargando && (
        <p className="mt-8 font-ticket text-sm text-tinta-suave">Cargando…</p>
      )}

      {error && (
        <p className="mt-8 rounded-md bg-rojo-perdida/10 px-4 py-3 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      {!cargando && !error && productos.length === 0 && (
        <p className="mt-8 text-sm text-tinta-suave">
          Todavía no cargaste ningún producto. Usá &ldquo;+ Nuevo producto&rdquo; para
          empezar.
        </p>
      )}

      {productos.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-lg border border-papel-linea">
          <table className="w-full text-left text-sm">
            <thead className="bg-papel-linea/40 text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const stockBajo = p.stock <= p.stockMinimo && p.stockMinimo > 0;
                return (
                  <tr key={p.id} className="border-t border-papel-linea">
                    <td className="px-4 py-3 text-tinta">{p.nombre}</td>
                    <td className="px-4 py-3 font-ticket text-xs text-tinta-suave">
                      {p.codigoBarras}
                    </td>
                    <td className="px-4 py-3 text-right font-ticket text-tinta">
                      {formatearCentavos(p.precioVentaCentavos)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-ticket ${
                        stockBajo ? 'font-semibold text-ambar' : 'text-tinta'
                      }`}
                    >
                      {p.stock}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductosPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoProductos />
    </RutaProtegida>
  );
}
