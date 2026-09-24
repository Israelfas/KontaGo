'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { ScannerCamara } from '@/components/scanner-camara';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { CifraAnimada } from '@/components/cifra';
import { FormularioAbrirCaja } from '@/components/caja';
import { Banda, Hoja } from '@/components/banda';
import { CameraIcon, CartIcon, CashIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import {
  buscarPorCodigoBarras,
  crearProducto,
  crearVenta,
  obtenerCajaActual,
  ApiError,
} from '@/lib/api';
import { formatearCentavos, numeroDeTicket } from '@/lib/formato';
import { centavosATexto, montosRapidos } from '@/lib/montos-rapidos';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import { aCentavos, avisoDelMargen } from '@/lib/validacion';
import type { MetodoPago, Producto, TurnoCaja, Venta } from '@/lib/tipos';

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
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), aCentavos(costoUnitario));

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
        Ese código no está en tu catálogo todavía. Cárgalo y se agrega a la venta al instante.
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
        {avisoMargen && (
          <p className="aviso-advertencia col-span-2 -mt-1 text-xs" aria-live="polite">
            {avisoMargen}
          </p>
        )}
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

function ContenidoVenta({ onCajaCerrada }: { onCajaCerrada: () => void }) {
  const { token, usuario } = useAuth();
  const pantallaChica = usePantallaChica();
  const [codigoInput, setCodigoInput] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
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
  const montoRecibidoCentavos = montoRecibido ? Math.round(parseFloat(montoRecibido) * 100) : null;
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
        // Crear productos es del admin (el backend responde 403 a un
        // cajero): al cajero solo se le avisa.
        if (usuario?.rol === 'admin') {
          setCodigoNoEncontrado(codigo.trim());
        } else {
          setErrorBusqueda(
            `El código ${codigo.trim()} no está en el catálogo. Pídele al administrador que lo cargue.`,
          );
        }
        return;
      }
      agregarAlCarrito(producto);
      setCodigoInput('');
      setConfirmacionEscaneo(producto.nombre);
      setTimeout(() => setConfirmacionEscaneo(null), 1200);
    } catch (err) {
      setErrorBusqueda(err instanceof ApiError ? err.message : 'No se pudo buscar el producto');
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
        .map((i) => (i.producto.id === productoId ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((prev) => prev.filter((i) => i.producto.id !== productoId));
  }

  const efectivo = metodoPago === 'efectivo';
  const puedeCobrar =
    carrito.length > 0 &&
    (!efectivo ||
      (montoRecibidoCentavos !== null && vueltoCentavos !== null && vueltoCentavos >= 0));

  async function confirmarVenta() {
    if (!token || !puedeCobrar) return;
    setErrorVenta(null);
    setProcesando(true);
    try {
      const venta = await crearVenta(token, {
        items: carrito.map((i) => ({
          productoId: i.producto.id,
          cantidad: i.cantidad,
        })),
        metodoPago,
        ...(efectivo ? { montoRecibidoCentavos: montoRecibidoCentavos! } : {}),
      });
      setVentaConfirmada(venta);
      // En el celular, un toque corto confirma sin mirar la pantalla.
      navigator.vibrate?.(12);
      setCarrito([]);
      setMontoRecibido('');
      setMetodoPago('efectivo');
    } catch (err) {
      // La caja se cerró mientras tanto (desde otra pestaña, o el admin):
      // volver a pedir que se abra. El carrito se pierde, pero no se cobró.
      if (err instanceof ApiError && err.statusCode === 409) {
        onCajaCerrada();
        return;
      }
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
          <div className="confirmacion app-card border-verde-ganancia/30 bg-verde-ganancia/5 p-6 text-center">
            {/* El círculo se dibuja y después el check, como una firma. */}
            <svg
              viewBox="0 0 52 52"
              className="mx-auto h-14 w-14 text-verde-ganancia"
              aria-hidden="true"
            >
              <circle
                className="check-circulo"
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className="check-trazo"
                d="M15 27l7.5 7.5L37 19.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-verde-ganancia">
              Venta registrada · ticket {numeroDeTicket(ventaConfirmada.numero)}
            </p>
            <p className="mt-2 font-ticket text-3xl font-semibold text-tinta">
              <CifraAnimada texto={formatearCentavos(ventaConfirmada.totalCentavos)} />
            </p>
            <div className="borde-perforado my-4" />
            {ventaConfirmada.metodoPago === 'transferencia' ? (
              <p className="text-sm font-medium text-tinta">Pagado por transferencia</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-tinta-suave">Recibido</span>
                  <span className="font-ticket text-tinta">
                    {formatearCentavos(ventaConfirmada.montoRecibidoCentavos)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-tinta">Vuelto</span>
                  <span className="font-ticket text-lg font-semibold text-ambar">
                    <CifraAnimada texto={formatearCentavos(ventaConfirmada.vueltoCentavos)} />
                  </span>
                </div>
              </>
            )}
          </div>
          <Button variant="primary" onClick={nuevaVenta} className="mt-6 w-full">
            Nueva venta
          </Button>
          {/* En otra pestaña, que se imprime sola: la caja queda lista para
              la próxima venta. */}
          <a
            href={`/ticket/${ventaConfirmada.id}?imprimir=1`}
            target="_blank"
            rel="noopener"
            className="button button-secondary mt-3 w-full"
          >
            Imprimir ticket
          </a>
        </div>
      </div>
    );
  }

  // --- Pantalla de armado del carrito ---
  const unidades = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  // Panel de cobro: en escritorio queda fijo a la derecha (como la
  // pantalla de una caja registradora); en celular cae debajo del ticket.
  const panelCobro = (
    <div className="app-card p-5">
      <p className="field-label" id="metodo-pago">
        Cómo paga
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="metodo-pago">
        {(
          [
            ['efectivo', 'Efectivo'],
            ['transferencia', 'Transferencia'],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={metodoPago === valor}
            onClick={() => {
              setMetodoPago(valor);
              setErrorVenta(null);
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              metodoPago === valor
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white text-tinta hover:border-tinta'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {!efectivo && (
        <p className="rounded-xl bg-papel px-3.5 py-3 text-sm text-tinta">
          Confirma en el celular que llegó la transferencia de{' '}
          <strong className="font-ticket">{formatearCentavos(totalCentavos)}</strong> antes de
          entregar. No entra al cajón.
        </p>
      )}

      {efectivo && (
        <>
          <label className="field-label" htmlFor="monto-recibido">
            Monto recibido
          </label>
          <input
            id="monto-recibido"
            type="number"
            step="0.01"
            min="0"
            disabled={carrito.length === 0}
            value={montoRecibido}
            onChange={(e) => setMontoRecibido(e.target.value)}
            className="field font-ticket !mb-0 disabled:opacity-50"
            placeholder="0.00"
          />

          {carrito.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Montos rápidos">
              {[totalCentavos, ...montosRapidos(totalCentavos)].map((centavos, i) => {
                const activo = montoRecibidoCentavos === centavos;
                return (
                  <button
                    key={centavos}
                    type="button"
                    onClick={() => setMontoRecibido(centavosATexto(centavos))}
                    className={`rounded-full border px-3 py-1.5 font-ticket text-xs font-semibold transition-colors ${
                      activo
                        ? 'border-tinta bg-tinta text-papel'
                        : 'border-papel-linea bg-white text-tinta hover:border-tinta'
                    }`}
                  >
                    {i === 0 ? 'Exacto' : formatearCentavos(centavos)}
                  </button>
                );
              })}
            </div>
          )}

          {vueltoCentavos !== null && carrito.length > 0 && (
            <div
              className={`mt-4 flex items-baseline justify-between rounded-xl px-3.5 py-3 ${
                vueltoCentavos >= 0 ? 'bg-ambar/10' : 'bg-rojo-perdida/10'
              }`}
            >
              <span className="text-sm font-medium text-tinta">
                {vueltoCentavos >= 0 ? 'Vuelto' : 'Falta'}
              </span>
              <span
                className={`font-ticket text-2xl font-semibold ${
                  vueltoCentavos >= 0 ? 'text-ambar' : 'text-rojo-perdida'
                }`}
              >
                {formatearCentavos(Math.abs(vueltoCentavos))}
              </span>
            </div>
          )}
        </>
      )}

      {errorVenta && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {errorVenta}
        </p>
      )}

      <Button
        variant="success"
        onClick={confirmarVenta}
        disabled={procesando || !puedeCobrar}
        className="mt-4 w-full"
      >
        {procesando ? 'Confirmando…' : efectivo ? 'Confirmar venta' : 'Cobrar por transferencia'}
      </Button>

      {carrito.length > 0 && (
        <button
          type="button"
          disabled={procesando}
          onClick={() => {
            if (window.confirm('¿Vaciar el carrito? Se quitan todos los productos.')) {
              setCarrito([]);
              setMontoRecibido('');
              setErrorVenta(null);
            }
          }}
          className="mt-3 w-full text-center text-xs font-medium text-tinta-suave underline hover:text-tinta"
        >
          Vaciar carrito
        </button>
      )}
    </div>
  );

  return (
    <div>
      <Banda
        eyebrow="Caja"
        titulo="Vender"
        valor={formatearCentavos(totalCentavos)}
        detalle={
          carrito.length === 0
            ? 'Escanea o escribe un código para empezar el ticket.'
            : `Total a cobrar · ${unidades} unidad${unidades === 1 ? '' : 'es'} de ${
                carrito.length
              } producto${carrito.length === 1 ? '' : 's'}`
        }
        accion={
          <Link href="/caja" className="button button-claro">
            <CashIcon className="h-4 w-4" />
            Mi caja
          </Link>
        }
      />

      <Hoja>
        {/* Dos columnas en escritorio: el ticket a la izquierda y el cobro
            siempre a la vista a la derecha. Antes todo iba en una columna
            angosta al medio, con media pantalla vacía. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div>
            <form onSubmit={manejarSubmitBusqueda}>
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
                  className="field flex-1 font-ticket !mb-0"
                  placeholder="Escanea o escribe el código y presiona Enter"
                />
                <Button type="submit" variant="primary" disabled={buscando}>
                  Agregar
                </Button>
              </div>
              {errorBusqueda && <p className="mt-2 text-sm text-rojo-perdida">{errorBusqueda}</p>}
            </form>

            {/* Fuera del <form> de búsqueda: un form dentro de otro es HTML
                inválido, y en React el submit del de adentro también dispara
                el onSubmit del de afuera (volvía a buscar el código). */}
            {codigoNoEncontrado && (
              <FormularioProductoNuevo
                codigoBarras={codigoNoEncontrado}
                onCreado={manejarProductoNuevoCreado}
                onCancelar={() => setCodigoNoEncontrado(null)}
              />
            )}

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
              <div className="mt-5">
                <EmptyState
                  icon={<CartIcon className="h-6 w-6" />}
                  title="El carrito está vacío"
                  description="Busca un producto por su código de barras para empezar."
                />
              </div>
            ) : pantallaChica ? (
              <ul className="mt-5 space-y-2">
                {carrito.map((item) => (
                  <li key={item.producto.id} className="entra app-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-tinta">{item.producto.nombre}</p>
                        <p className="font-ticket text-xs text-tinta-suave">
                          {formatearCentavos(item.producto.precioVentaCentavos)} c/u
                        </p>
                      </div>
                      <p className="shrink-0 font-ticket font-semibold text-tinta">
                        {formatearCentavos(item.producto.precioVentaCentavos * item.cantidad)}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 rounded-full border border-papel-linea bg-white p-1">
                        <button
                          onClick={() => cambiarCantidad(item.producto.id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-suave"
                          aria-label={`Quitar una unidad de ${item.producto.nombre}`}
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        {/* La key hace que el número lata cada vez que cambia. */}
                        <span
                          key={item.cantidad}
                          className="latido w-6 text-center font-ticket font-semibold text-tinta"
                        >
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => cambiarCantidad(item.producto.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-suave"
                          aria-label={`Agregar una unidad de ${item.producto.nombre}`}
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => quitarDelCarrito(item.producto.id)}
                        className="flex h-8 w-8 items-center justify-center text-tinta-suave"
                        aria-label={`Quitar ${item.producto.nombre} del carrito`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="table-shell mt-5">
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
                      <tr key={item.producto.id} className="entra border-t border-papel-linea">
                        <td className="px-4 py-3">
                          <p className="text-tinta">{item.producto.nombre}</p>
                          <p className="font-ticket text-xs text-tinta-suave">
                            {formatearCentavos(item.producto.precioVentaCentavos)} c/u
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => cambiarCantidad(item.producto.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-papel-linea text-tinta-suave transition-colors hover:border-tinta hover:text-tinta"
                              aria-label={`Quitar una unidad de ${item.producto.nombre}`}
                            >
                              <MinusIcon className="h-3 w-3" />
                            </button>
                            <span
                              key={item.cantidad}
                              className="latido w-7 text-center font-ticket text-tinta"
                            >
                              {item.cantidad}
                            </span>
                            <button
                              onClick={() => cambiarCantidad(item.producto.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-papel-linea text-tinta-suave transition-colors hover:border-tinta hover:text-tinta"
                              aria-label={`Agregar una unidad de ${item.producto.nombre}`}
                            >
                              <PlusIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-ticket font-medium text-tinta">
                          {formatearCentavos(item.producto.precioVentaCentavos * item.cantidad)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => quitarDelCarrito(item.producto.id)}
                            className="text-tinta-suave transition-colors hover:text-rojo-perdida"
                            aria-label={`Quitar ${item.producto.nombre} del carrito`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24">{panelCobro}</div>
        </div>
      </Hoja>
    </div>
  );
}

/**
 * Sin caja abierta no se vende: primero se abre con el cambio del cajón
 * (así todas las ventas caen en un turno y el arqueo cuadra).
 */
function VentaConCaja() {
  const { token } = useAuth();
  const [caja, setCaja] = useState<TurnoCaja | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    if (!token) return;
    setError(null);
    obtenerCajaActual(token)
      .then(setCaja)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo revisar la caja'),
      );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (caja) return <ContenidoVenta onCajaCerrada={() => setCaja(null)} />;

  return (
    <div>
      <Banda
        eyebrow="Caja"
        titulo="Vender"
        detalle={caja === null ? 'Tu caja está cerrada. Ábrela para empezar a cobrar.' : undefined}
      />
      <Hoja>
        <div className="mt-4">
          {error && (
            <ErrorState
              action={
                <Button variant="secondary" onClick={cargar}>
                  Reintentar
                </Button>
              }
            >
              {error}
            </ErrorState>
          )}
          {caja === undefined && !error && <LoadingState label="Revisando la caja…" />}
          {caja === null && <FormularioAbrirCaja onAbierta={setCaja} />}
        </div>
      </Hoja>
    </div>
  );
}

export default function VentaPage() {
  return (
    <RutaProtegida>
      <Nav />
      <VentaConCaja />
    </RutaProtegida>
  );
}
