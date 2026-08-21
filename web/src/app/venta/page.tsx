'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { ScannerCamara } from '@/components/scanner-camara';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { CameraIcon, CartIcon, CheckIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { buscarPorCodigoBarras, crearProducto, crearVenta, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import type { Producto, Venta } from '@/lib/tipos';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// --- Alta rápida de producto no encontrado durante la venta ---

function FormularioProductoNuevo({
  codigoBarras,
  onCreado,
  onCancelar,
}: {
  codigoBarras: string;
  onCreado: (producto: Producto) => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="app-card mt-3 p-4">
      <p className="text-sm font-medium text-tinta">
        Producto nuevo · <span className="font-ticket text-tinta-suave">{codigoBarras}</span>
      </p>
      <p className="mt-0.5 text-xs text-tinta-suave">
        Ese código no está en tu catálogo todavía. Cargalo y se agrega a la venta al instante.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="field-label" htmlFor="np-nombre">
            Nombre
          </label>
          <input
            id="np-nombre"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="field"
            placeholder="Coca Cola 500ml"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="np-precio">
            Precio de venta
          </label>
          <input
            id="np-precio"
            required
            type="number"
            step="0.01"
            min="0"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            className="field font-ticket"
            placeholder="1.50"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="np-costo">
            Costo unitario
          </label>
          <input
            id="np-costo"
            type="number"
            step="0.01"
            min="0"
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            className="field font-ticket"
            placeholder="0.90"
          />
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="np-stock">
            Stock inicial
          </label>
          <input
            id="np-stock"
            type="number"
            min="0"
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
            className="field font-ticket"
            placeholder="20"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando || !nombre || !precioVenta}>
          {enviando ? 'Creando…' : 'Crear y agregar a la venta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ContenidoVenta() {
  const { token } = useAuth();
  const [codigoInput, setCodigoInput] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [montoRecibido, setMontoRecibido] = useState('');
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<Venta | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [confirmacionEscaneo, setConfirmacionEscaneo] = useState<string | null>(null);

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

  function agregarAlCarrito(producto: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  async function buscarYAgregar(codigo: string) {
    if (!token || !codigo.trim()) return;
    setErrorBusqueda(null);
    setCodigoNoEncontrado(null);
    setBuscando(true);
    try {
      const producto = await buscarPorCodigoBarras(token, codigo.trim());
      if (!producto) {
        // En vez de solo avisar que no existe, dejamos el código a mano
        // para ofrecer darlo de alta ahí mismo — es el flujo real de una
        // caja: llega un producto nuevo, se escanea, y hay que poder
        // cargarlo sin cortar la venta.
        setCodigoNoEncontrado(codigo.trim());
        return;
      }
      agregarAlCarrito(producto);
      setCodigoInput('');
      setConfirmacionEscaneo(producto.nombre);
      setTimeout(() => setConfirmacionEscaneo(null), 1200);
    } catch (err) {
      setErrorBusqueda(
        err instanceof ApiError ? err.message : 'No se pudo buscar el producto',
      );
    } finally {
      setBuscando(false);
      inputCodigoRef.current?.focus();
    }
  }

  function manejarProductoNuevoCreado(producto: Producto) {
    agregarAlCarrito(producto);
    setCodigoNoEncontrado(null);
    setCodigoInput('');
    setConfirmacionEscaneo(producto.nombre);
    setTimeout(() => setConfirmacionEscaneo(null), 1200);
    inputCodigoRef.current?.focus();
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
          i.producto.id === productoId ? { ...i, cantidad: i.cantidad + delta } : i,
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
      <div className="app-page">
        <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
          <div className="app-card border-verde-ganancia/30 bg-verde-ganancia/5 p-6 text-center">
            <span className="metric-icon !relative !z-auto !mx-auto !mt-0 !bg-verde-ganancia/15 !text-verde-ganancia">
              <CheckIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-verde-ganancia">
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
          <Button variant="primary" onClick={nuevaVenta} className="mt-6 w-full">
            Nueva venta
          </Button>
        </div>
      </div>
    );
  }

  // --- Pantalla de armado del carrito ---
  return (
    <div className="app-page">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <PageHeader eyebrow="Caja" title="Vender" />

        <form onSubmit={manejarSubmitBusqueda} className="mt-6">
          <label className="field-label" htmlFor="codigo-barras">
            Código de barras
          </label>
          <div className="flex gap-2">
            <input
              id="codigo-barras"
              ref={inputCodigoRef}
              autoFocus
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
              onKeyDown={manejarTecla}
              className="field flex-1 font-ticket"
              placeholder="Escaneá o tipeá el código y presioná Enter"
            />
            <Button type="submit" variant="primary" disabled={buscando}>
              Agregar
            </Button>
          </div>
          {errorBusqueda && <p className="mt-2 text-sm text-rojo-perdida">{errorBusqueda}</p>}

          {codigoNoEncontrado && (
            <FormularioProductoNuevo
              codigoBarras={codigoNoEncontrado}
              onCreado={manejarProductoNuevoCreado}
              onCancelar={() => setCodigoNoEncontrado(null)}
            />
          )}
        </form>

        <div className="mt-3">
          {camaraActiva ? (
            <ScannerCamara
              onDetectado={(codigo) => buscarYAgregar(codigo)}
              onCerrar={() => setCamaraActiva(false)}
              confirmacion={confirmacionEscaneo}
            />
          ) : (
            <button
              onClick={() => setCamaraActiva(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-papel-linea py-3 text-sm text-tinta-suave transition-colors hover:border-tinta hover:text-tinta"
            >
              <CameraIcon className="h-4 w-4" />
              Escanear con la cámara
            </button>
          )}
        </div>

        {carrito.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<CartIcon className="h-6 w-6" />}
              title="El carrito está vacío"
              description="Buscá un producto por su código de barras para empezar."
            />
          </div>
        ) : (
          <div className="table-shell mt-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-center">Cant.</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
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
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-papel-linea text-tinta-suave hover:bg-papel-linea/60"
                          aria-label="Restar"
                        >
                          <MinusIcon className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-ticket text-tinta">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => cambiarCantidad(item.producto.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-papel-linea text-tinta-suave hover:bg-papel-linea/60"
                          aria-label="Sumar"
                        >
                          <PlusIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-ticket text-tinta">
                      {formatearCentavos(item.producto.precioVentaCentavos * item.cantidad)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => quitarDelCarrito(item.producto.id)}
                        className="text-tinta-suave hover:text-rojo-perdida"
                        aria-label="Quitar del carrito"
                      >
                        <TrashIcon className="h-4 w-4" />
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
                <label className="field-label" htmlFor="monto-recibido">
                  Monto recibido
                </label>
                <input
                  id="monto-recibido"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="field font-ticket"
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
                <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
                  {errorVenta}
                </p>
              )}

              <Button
                variant="success"
                onClick={confirmarVenta}
                disabled={
                  procesando ||
                  montoRecibidoCentavos === null ||
                  vueltoCentavos === null ||
                  vueltoCentavos < 0
                }
                className="mt-4 w-full"
              >
                {procesando ? 'Confirmando…' : 'Confirmar venta'}
              </Button>
            </div>
          </div>
        )}
      </div>
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