'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { ScannerCamara } from '@/components/scanner-camara';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { CifraAnimada } from '@/components/cifra';
import { FormularioAbrirCaja } from '@/components/caja';
import { Banda, Hoja } from '@/components/banda';
import { CameraIcon, CartIcon, CashIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { AvisoSinConexion } from '@/components/aviso-sin-conexion';
import { useAuth } from '@/lib/auth-context';
import {
  esFaltaDeConexion,
  nuevaClave,
  useSinConexion,
  type VentaPendiente,
} from '@/lib/sin-conexion';
import {
  buscarPorCodigoBarras,
  crearProducto,
  crearVenta,
  obtenerCajaActual,
  ApiError,
} from '@/lib/api';
import { buscarPorNombre, esCodigoInterno } from '@/lib/filtro-productos';
import { formatearCantidad, importeCentavos, porPeso, precioPor, redondear } from '@/lib/cantidad';
import { VentanaPeso } from '@/components/ventana-peso';
import { formatearCentavos, numeroDeTicket } from '@/lib/formato';
import { centavosATexto, montosRapidos } from '@/lib/montos-rapidos';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import { aCentavos, avisoDelMargen } from '@/lib/validacion';
import type { ClienteFiado, MetodoPago, Producto, TurnoCaja, Venta } from '@/lib/tipos';
import { SelectorCliente } from '@/components/selector-cliente';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// --- Alta rápida de producto no encontrado durante la venta ---

function FormularioProductoNuevo({
  codigoBarras,
  nombreInicial = '',
  onCreado,
  onCancelar,
}: {
  // null: se buscó por nombre y no está (pan, huevos): va sin código.
  codigoBarras: string | null;
  nombreInicial?: string;
  onCreado: (producto: Producto) => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState(nombreInicial);
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
        codigoBarras: codigoBarras ?? undefined,
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
        Producto nuevo ·{' '}
        <span className="font-ticket text-tinta-suave">{codigoBarras ?? 'sin código'}</span>
      </p>
      <p className="mt-0.5 text-xs text-tinta-suave">
        {codigoBarras
          ? 'Ese código no está en tu catálogo todavía. Cárgalo y se agrega a la venta al instante.'
          : 'No hay ningún producto con ese nombre. Cárgalo sin código (la próxima vez lo encuentras por su nombre) y se agrega a la venta al instante.'}
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
  // Lo que se buscó y no está: el admin lo puede cargar ahí mismo.
  const [noEncontrado, setNoEncontrado] = useState<{
    codigoBarras: string | null;
    nombre: string;
  } | null>(null);
  // La sugerencia marcada con las flechas (Enter la agrega).
  const [sugerenciaActiva, setSugerenciaActiva] = useState(0);
  // Algo que va por peso: se pregunta cuánto (o se cambia lo del carrito).
  const [pesando, setPesando] = useState<{ producto: Producto; cambiando: boolean } | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  // Al fiado: a quién (se elige en el panel de cobro).
  const [clienteFiado, setClienteFiado] = useState<ClienteFiado | null>(null);
  // Para la confirmación: a quién se le fió la última venta.
  const [fiadoA, setFiadoA] = useState<string | null>(null);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<Venta | null>(null);
  // Cobrada sin conexión: guardada en el navegador, se manda sola después.
  const [ventaGuardada, setVentaGuardada] = useState<VentaPendiente | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const {
    sinConexion,
    catalogo,
    marcarSinConexion,
    actualizarCatalogo,
    buscarEnCatalogo,
    descontarDelCatalogo,
    guardarVenta,
  } = useSinConexion();
  const [confirmacionEscaneo, setConfirmacionEscaneo] = useState<string | null>(null);

  const inputCodigoRef = useRef<HTMLInputElement>(null);

  const totalCentavos = carrito.reduce(
    (acc, item) => acc + importeCentavos(item.producto.precioVentaCentavos, item.cantidad),
    0,
  );
  const montoRecibidoCentavos = montoRecibido ? Math.round(parseFloat(montoRecibido) * 100) : null;
  const vueltoCentavos =
    montoRecibidoCentavos !== null ? montoRecibidoCentavos - totalCentavos : null;

  // Solo números: un código (lo que manda el lector). Con letras: un nombre,
  // y se buscan en el catálogo guardado (anda también sin conexión).
  const textoBuscado = codigoInput.trim();
  const buscaNombre = textoBuscado.length >= 2 && !/^\d+$/.test(textoBuscado);
  const sugerencias =
    buscaNombre && catalogo ? buscarPorNombre(catalogo.productos, textoBuscado) : [];
  const activa = Math.min(sugerenciaActiva, Math.max(0, sugerencias.length - 1));

  // Lo que no trae código (pan, huevos, lo suelto), a un toque.
  const sinCodigo = useMemo(
    () =>
      (catalogo?.productos ?? [])
        .filter((p) => esCodigoInterno(p.codigoBarras))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 12),
    [catalogo],
  );

  function agregarAlCarrito(producto: Producto, cantidad = 1) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: redondear(i.cantidad + cantidad) } : i,
        );
      }
      return [...prev, { producto, cantidad }];
    });
  }

  /** Lo del carrito que va por peso, con la cantidad nueva. */
  function ponerCantidad(productoId: string, cantidad: number) {
    setCarrito((prev) => prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad } : i)));
  }

  /**
   * Al carrito: una unidad, o si va por peso, primero se pregunta cuánto.
   */
  function elegir(producto: Producto) {
    setCodigoInput('');
    if (porPeso(producto.unidad)) {
      setPesando({ producto, cambiando: false });
      return;
    }
    agregarAlCarrito(producto);
    setConfirmacionEscaneo(producto.nombre);
    setTimeout(() => setConfirmacionEscaneo(null), 1200);
    inputCodigoRef.current?.focus();
  }

  function listoElPeso(cantidad: number) {
    if (!pesando) return;
    if (pesando.cambiando) ponerCantidad(pesando.producto.id, cantidad);
    else agregarAlCarrito(pesando.producto, cantidad);
    setPesando(null);
    inputCodigoRef.current?.focus();
  }

  /** Sin conexión: lo que queda del producto según el stock guardado. */
  function disponibleSinConexion(producto: Producto, sinContarElCarrito = false): number {
    const enCarrito = sinContarElCarrito
      ? 0
      : (carrito.find((i) => i.producto.id === producto.id)?.cantidad ?? 0);
    return redondear(producto.stock - enCarrito);
  }

  /** Sin conexión: busca en el catálogo guardado y cuida el stock guardado. */
  function agregarDelCatalogoGuardado(codigo: string) {
    const producto = buscarEnCatalogo(codigo);
    if (!producto) {
      setErrorBusqueda(
        `Sin conexión: el código ${codigo} no está en el catálogo guardado en este navegador.`,
      );
      return;
    }
    agregarDelCatalogo(producto);
  }

  /**
   * Un producto elegido del catálogo (por nombre, o sin código). Sin
   * conexión, el stock guardado es lo único que se sabe: se cuida acá.
   */
  function agregarDelCatalogo(producto: Producto) {
    setErrorBusqueda(null);
    setNoEncontrado(null);
    if (sinConexion) {
      // Por unidad, que alcance una más; por peso, que quede algo (cuánto
      // se revisa al poner la cantidad).
      const queda = disponibleSinConexion(producto);
      if (porPeso(producto.unidad) ? queda <= 0 : queda < 1) {
        setErrorBusqueda(
          producto.stock === 0
            ? `Según el último stock guardado, no queda ${producto.nombre}.`
            : `Según el último stock guardado, quedan ${formatearCantidad(producto.stock, producto.unidad)} de ${producto.nombre}.`,
        );
        return;
      }
    }
    elegir(producto);
  }

  async function buscarYAgregar(codigo: string) {
    if (!token || !codigo.trim()) return;
    setErrorBusqueda(null);
    setNoEncontrado(null);
    // Ya se sabe que no hay red: directo a lo guardado, sin esperar.
    if (sinConexion) {
      agregarDelCatalogoGuardado(codigo.trim());
      inputCodigoRef.current?.focus();
      return;
    }
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
        // Con letras se buscaba un nombre: el producto nuevo va sin código.
        const esNombre = !/^\d+$/.test(codigo.trim());
        if (usuario?.rol === 'admin') {
          setNoEncontrado(
            esNombre
              ? { codigoBarras: null, nombre: codigo.trim() }
              : { codigoBarras: codigo.trim(), nombre: '' },
          );
        } else {
          setErrorBusqueda(
            esNombre
              ? `No hay ningún producto que se llame “${codigo.trim()}”. Pídele al administrador que lo cargue.`
              : `El código ${codigo.trim()} no está en el catálogo. Pídele al administrador que lo cargue.`,
          );
        }
        return;
      }
      elegir(producto);
    } catch (err) {
      if (esFaltaDeConexion(err)) {
        marcarSinConexion(true);
        agregarDelCatalogoGuardado(codigo.trim());
        return;
      }
      setErrorBusqueda(err instanceof ApiError ? err.message : 'No se pudo buscar el producto');
    } finally {
      setBuscando(false);
      inputCodigoRef.current?.focus();
    }
  }

  function manejarProductoNuevoCreado(producto: Producto) {
    agregarAlCarrito(producto);
    setNoEncontrado(null);
    // Al catálogo guardado: así se lo encuentra por nombre ya mismo.
    void actualizarCatalogo();
    setCodigoInput('');
    setConfirmacionEscaneo(producto.nombre);
    setTimeout(() => setConfirmacionEscaneo(null), 1200);
    inputCodigoRef.current?.focus();
  }

  /** Enter o "Agregar": la sugerencia marcada, o buscar el código. */
  function agregarLoEscrito() {
    if (sugerencias.length > 0) {
      agregarDelCatalogo(sugerencias[activa]);
      return;
    }
    buscarYAgregar(codigoInput);
  }

  function manejarSubmitBusqueda(e: FormEvent) {
    e.preventDefault();
    agregarLoEscrito();
  }

  // Los lectores de código de barras "escriben" el código y mandan un
  // Enter automático — el submit del form ya cubre ese caso, pero dejamos
  // el handler de teclado explícito por si el input queda embebido en
  // algo que no dispare submit. Las flechas recorren las sugerencias.
  function manejarTecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarLoEscrito();
    } else if (e.key === 'ArrowDown' && sugerencias.length > 0) {
      e.preventDefault();
      setSugerenciaActiva((activa + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp' && sugerencias.length > 0) {
      e.preventDefault();
      setSugerenciaActiva((activa - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === 'Escape' && codigoInput) {
      setCodigoInput('');
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
  const fiado = metodoPago === 'fiado';
  const puedeCobrar =
    carrito.length > 0 &&
    (fiado
      ? clienteFiado !== null
      : !efectivo ||
        (montoRecibidoCentavos !== null && vueltoCentavos !== null && vueltoCentavos >= 0));

  async function confirmarVenta() {
    if (!token || !puedeCobrar) return;
    setErrorVenta(null);
    // La clave y la hora se fijan ahora: si hay que mandarla después, es
    // la misma venta, cobrada en este momento.
    const clave = nuevaClave();
    const vendidaEn = new Date().toISOString();
    const items = carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad }));

    const limpiar = () => {
      // En el celular, un toque corto confirma sin mirar la pantalla.
      navigator.vibrate?.(12);
      setCarrito([]);
      setMontoRecibido('');
      setMetodoPago('efectivo');
      setFiadoA(clienteFiado?.nombre ?? null);
      setClienteFiado(null);
    };
    const guardarParaDespues = () => {
      const pendiente: VentaPendiente = {
        clave,
        vendidaEn,
        items: carrito.map((i) => ({
          productoId: i.producto.id,
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precioVentaCentavos: i.producto.precioVentaCentavos,
        })),
        metodoPago,
        ...(efectivo ? { montoRecibidoCentavos: montoRecibidoCentavos! } : {}),
        ...(fiado && clienteFiado
          ? { clienteId: clienteFiado.id, clienteNombre: clienteFiado.nombre }
          : {}),
        totalCentavos,
      };
      guardarVenta(pendiente);
      descontarDelCatalogo(items);
      setVentaGuardada(pendiente);
      limpiar();
    };

    if (sinConexion) {
      guardarParaDespues();
      return;
    }

    setProcesando(true);
    try {
      const venta = await crearVenta(token, {
        items,
        metodoPago,
        ...(efectivo ? { montoRecibidoCentavos: montoRecibidoCentavos! } : {}),
        ...(fiado && clienteFiado ? { clienteId: clienteFiado.id } : {}),
        claveIdempotencia: clave,
        vendidaEn,
      });
      setVentaConfirmada(venta);
      descontarDelCatalogo(items);
      limpiar();
    } catch (err) {
      // Se cortó (o no respondió a tiempo): queda guardada y se manda
      // sola. Si en realidad sí llegó, la clave evita cobrarla dos veces.
      if (esFaltaDeConexion(err)) {
        marcarSinConexion(true);
        guardarParaDespues();
        return;
      }
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
    setVentaGuardada(null);
    inputCodigoRef.current?.focus();
  }

  // --- Cobrada sin conexión ---
  if (ventaGuardada) {
    const vuelto =
      ventaGuardada.montoRecibidoCentavos !== undefined
        ? ventaGuardada.montoRecibidoCentavos - ventaGuardada.totalCentavos
        : null;
    return (
      <div className="app-page">
        <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
          <div className="confirmacion app-card border-ambar/30 bg-ambar/5 p-6 text-center">
            <svg viewBox="0 0 52 52" className="mx-auto h-14 w-14 text-ambar" aria-hidden="true">
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
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#9a5b08]">
              Venta guardada sin conexión
            </p>
            <p className="mt-2 font-ticket text-3xl font-semibold text-tinta">
              <CifraAnimada texto={formatearCentavos(ventaGuardada.totalCentavos)} />
            </p>
            <div className="borde-perforado my-4" />
            {ventaGuardada.metodoPago === 'fiado' ? (
              <p className="text-sm font-medium text-tinta">
                Al fiado · {ventaGuardada.clienteNombre}
              </p>
            ) : vuelto === null ? (
              <p className="text-sm font-medium text-tinta">Pagado por transferencia</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-tinta-suave">Recibido</span>
                  <span className="font-ticket text-tinta">
                    {formatearCentavos(ventaGuardada.montoRecibidoCentavos!)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-tinta">Vuelto</span>
                  <span className="font-ticket text-lg font-semibold text-ambar">
                    <CifraAnimada texto={formatearCentavos(vuelto)} />
                  </span>
                </div>
              </>
            )}
            <div className="borde-perforado my-4" />
            <p className="text-xs text-tinta-suave">
              Se envía sola cuando vuelva internet, con la hora de ahora. El número de ticket se le
              asigna al enviarla.
            </p>
          </div>
          <Button variant="primary" onClick={nuevaVenta} className="mt-6 w-full">
            Nueva venta
          </Button>
        </div>
      </div>
    );
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
            {ventaConfirmada.metodoPago === 'fiado' ? (
              <p className="text-sm font-medium text-tinta">
                Anotado al fiado de {fiadoA ?? 'el cliente'}. Queda en su cuenta, en Fiados.
              </p>
            ) : ventaConfirmada.metodoPago === 'transferencia' ? (
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
  const unidades = carrito.reduce(
    (acc, item) => acc + (porPeso(item.producto.unidad) ? 1 : item.cantidad),
    0,
  );

  // Panel de cobro: en escritorio queda fijo a la derecha (como la
  // pantalla de una caja registradora); en celular cae debajo del ticket.
  const panelCobro = (
    <div className="app-card p-5">
      <p className="field-label" id="metodo-pago">
        Cómo paga
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="metodo-pago">
        {(
          [
            ['efectivo', 'Efectivo'],
            ['transferencia', 'Transferencia'],
            ['fiado', 'Fiado'],
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
            className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors ${
              metodoPago === valor
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white text-tinta hover:border-tinta'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {fiado && (
        <>
          <SelectorCliente elegido={clienteFiado} onElegir={setClienteFiado} />
          {clienteFiado && (
            <p className="mt-2 text-xs text-tinta-suave">
              {formatearCentavos(totalCentavos)} se anotan en su cuenta. No entra nada al cajón.
            </p>
          )}
        </>
      )}

      {metodoPago === 'transferencia' && (
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
        {procesando
          ? 'Confirmando…'
          : efectivo
            ? 'Confirmar venta'
            : fiado
              ? 'Anotar al fiado'
              : 'Cobrar por transferencia'}
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
        <AvisoSinConexion />
        {/* Dos columnas en escritorio: el ticket a la izquierda y el cobro
            siempre a la vista a la derecha. Antes todo iba en una columna
            angosta al medio, con media pantalla vacía. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div>
            <form onSubmit={manejarSubmitBusqueda}>
              <label className="field-label" htmlFor="codigo-barras">
                Código de barras o nombre
              </label>
              <div className="relative flex gap-2">
                <input
                  id="codigo-barras"
                  ref={inputCodigoRef}
                  autoFocus
                  autoComplete="off"
                  value={codigoInput}
                  onChange={(e) => {
                    setCodigoInput(e.target.value);
                    setSugerenciaActiva(0);
                  }}
                  onKeyDown={manejarTecla}
                  className="field flex-1 font-ticket !mb-0"
                  placeholder="Escanea, escribe el código o busca por nombre"
                  role="combobox"
                  aria-expanded={sugerencias.length > 0}
                  aria-controls="sugerencias-venta"
                  aria-activedescendant={
                    sugerencias.length > 0 ? `sugerencia-${sugerencias[activa].id}` : undefined
                  }
                />
                <Button type="submit" variant="primary" disabled={buscando}>
                  Agregar
                </Button>
                {sugerencias.length > 0 && (
                  <ul
                    id="sugerencias-venta"
                    role="listbox"
                    aria-label="Productos que coinciden"
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-papel-linea bg-white shadow-lg"
                  >
                    {sugerencias.map((p, i) => (
                      <li
                        key={p.id}
                        id={`sugerencia-${p.id}`}
                        role="option"
                        aria-selected={i === activa}
                        // Antes de que el campo pierda el foco.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          agregarDelCatalogo(p);
                        }}
                        onMouseEnter={() => setSugerenciaActiva(i)}
                        className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm ${
                          i === activa ? 'bg-papel' : ''
                        }`}
                      >
                        <span className="min-w-0 truncate text-tinta">{p.nombre}</span>
                        <span className="shrink-0 font-ticket text-xs text-tinta-suave">
                          {formatearCentavos(p.precioVentaCentavos)} · stock {p.stock}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errorBusqueda && <p className="mt-2 text-sm text-rojo-perdida">{errorBusqueda}</p>}
            </form>

            {sinCodigo.length > 0 && (
              <div className="mt-3">
                <p className="field-label">Sin código de barras</p>
                <div className="flex flex-wrap gap-2">
                  {sinCodigo.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarDelCatalogo(p)}
                      className="rounded-full border border-papel-linea bg-white px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:border-tinta"
                    >
                      {p.nombre}{' '}
                      <span className="font-ticket font-normal text-tinta-suave">
                        {formatearCentavos(p.precioVentaCentavos)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fuera del <form> de búsqueda: un form dentro de otro es HTML
                inválido, y en React el submit del de adentro también dispara
                el onSubmit del de afuera (volvía a buscar el código). */}
            {noEncontrado && (
              <FormularioProductoNuevo
                // Otro producto no encontrado: el formulario empieza de cero.
                key={`${noEncontrado.codigoBarras}-${noEncontrado.nombre}`}
                codigoBarras={noEncontrado.codigoBarras}
                nombreInicial={noEncontrado.nombre}
                onCreado={manejarProductoNuevoCreado}
                onCancelar={() => setNoEncontrado(null)}
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
                          {formatearCentavos(item.producto.precioVentaCentavos)}
                          {porPeso(item.producto.unidad) ? precioPor(item.producto.unidad) : ' c/u'}
                        </p>
                      </div>
                      <p className="shrink-0 font-ticket font-semibold text-tinta">
                        {formatearCentavos(
                          importeCentavos(item.producto.precioVentaCentavos, item.cantidad),
                        )}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      {porPeso(item.producto.unidad) ? (
                        <button
                          type="button"
                          onClick={() => setPesando({ producto: item.producto, cambiando: true })}
                          className="rounded-full border border-papel-linea bg-white px-4 py-2 font-ticket text-sm font-semibold text-tinta"
                          aria-label={`Cambiar cuánto de ${item.producto.nombre}`}
                        >
                          {formatearCantidad(item.cantidad, item.producto.unidad)}
                        </button>
                      ) : (
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
                      )}
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
                            {formatearCentavos(item.producto.precioVentaCentavos)}
                            {porPeso(item.producto.unidad)
                              ? precioPor(item.producto.unidad)
                              : ' c/u'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {porPeso(item.producto.unidad) ? (
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setPesando({ producto: item.producto, cambiando: true })
                                }
                                className="rounded-md border border-papel-linea px-2.5 py-1 font-ticket text-tinta transition-colors hover:border-tinta"
                                aria-label={`Cambiar cuánto de ${item.producto.nombre}`}
                              >
                                {formatearCantidad(item.cantidad, item.producto.unidad)}
                              </button>
                            </div>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-ticket font-medium text-tinta">
                          {formatearCentavos(
                            importeCentavos(item.producto.precioVentaCentavos, item.cantidad),
                          )}
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

      {pesando && (
        <VentanaPeso
          // Otro producto: la ventana empieza de cero.
          key={`${pesando.producto.id}-${pesando.cambiando}`}
          producto={pesando.producto}
          inicial={
            pesando.cambiando
              ? carrito.find((i) => i.producto.id === pesando.producto.id)?.cantidad
              : undefined
          }
          maximo={
            sinConexion ? disponibleSinConexion(pesando.producto, pesando.cambiando) : undefined
          }
          onListo={listoElPeso}
          onCerrar={() => {
            setPesando(null);
            inputCodigoRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * Sin caja abierta no se vende: primero se abre con el cambio del cajón
 * (así todas las ventas caen en un turno y el arqueo cuadra).
 */
function VentaConCaja() {
  const { token } = useAuth();
  const { sinConexion, ultimaCaja, marcarSinConexion, recordarCaja, actualizarCatalogo } =
    useSinConexion();
  const [caja, setCaja] = useState<TurnoCaja | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Por ref: la caja guardada se lee después de que falla el pedido.
  const ultimaCajaRef = useRef(ultimaCaja);
  useEffect(() => {
    ultimaCajaRef.current = ultimaCaja;
  }, [ultimaCaja]);

  // Sin conexión se sigue con la caja como se vio la última vez, y con el
  // catálogo guardado.
  function cargar() {
    if (!token) return;
    setError(null);
    obtenerCajaActual(token)
      .then((turno) => {
        setCaja(turno);
        recordarCaja(turno);
        marcarSinConexion(false);
        // Con conexión, el catálogo guardado se pone al día.
        void actualizarCatalogo();
      })
      .catch((err) => {
        if (esFaltaDeConexion(err)) {
          marcarSinConexion(true);
          if (ultimaCajaRef.current !== undefined) {
            setCaja(ultimaCajaRef.current);
            return;
          }
          setError(
            'Sin conexión, y todavía no se sabe si tu caja está abierta. Conéctate una vez para empezar.',
          );
          return;
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo revisar la caja');
      });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Si se cortó antes de saber cómo está la caja, al leer la guardada se usa.
  useEffect(() => {
    if (sinConexion && caja === undefined && ultimaCaja !== undefined) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setCaja(ultimaCaja);
      setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [sinConexion, caja, ultimaCaja]);

  if (caja)
    return (
      <ContenidoVenta
        onCajaCerrada={() => {
          setCaja(null);
          recordarCaja(null);
        }}
      />
    );

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
          {caja === null && (
            <FormularioAbrirCaja
              onAbierta={(turno) => {
                setCaja(turno);
                recordarCaja(turno);
                void actualizarCatalogo();
              }}
            />
          )}
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
