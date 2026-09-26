'use client';

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { AvisoDeCampo, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { BoxIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { Ventana, VentanaPie, useVentana } from '@/components/ventana';
import { useAuth } from '@/lib/auth-context';
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  darDeBajaProducto,
  reactivarProducto,
  listarProductosDadosDeBaja,
  ApiError,
} from '@/lib/api';
import { formatearCentavos, formatearFechaCorta } from '@/lib/formato';
import Link from 'next/link';
import { resumenDeLotes, tieneVariosLotes } from '@/lib/lotes';
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import { aCentavos, avisoDelMargen, avisoDelVencimiento } from '@/lib/validacion';
import {
  esCodigoInterno,
  estaPorVencer,
  filtrarProductos,
  porReponer,
  textoDelCodigo,
  type FiltroProductos,
} from '@/lib/filtro-productos';
import type { Producto } from '@/lib/tipos';
import {
  UNIDADES,
  formatearCantidad,
  leerCantidad,
  pasoDe,
  porPeso,
  precioPor,
  type UnidadDeVenta,
} from '@/lib/cantidad';

/** Cómo se vende: por unidad o por peso (el precio y el stock van en esa unidad). */
function SelectorUnidad({
  valor,
  onCambio,
}: {
  valor: UnidadDeVenta;
  onCambio: (u: UnidadDeVenta) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Cómo se vende" className="grid grid-cols-3 gap-2">
      {UNIDADES.map((u) => (
        <button
          key={u.valor}
          type="button"
          role="radio"
          aria-checked={valor === u.valor}
          onClick={() => onCambio(u.valor)}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
            valor === u.valor
              ? 'border-tinta bg-tinta text-papel'
              : 'border-papel-linea bg-white text-tinta hover:border-tinta'
          }`}
        >
          {u.texto}
        </button>
      ))}
    </div>
  );
}

/** "Precio de venta" o "Precio por libra". */
function etiquetaPor(base: string, unidad: UnidadDeVenta): string {
  if (unidad === 'libra') return `${base} por libra`;
  if (unidad === 'kilo') return `${base} por kilo`;
  return base;
}

/** Aclaración de la unidad en los campos de stock: " (lb)". */
function enUnidad(unidad: UnidadDeVenta): string {
  return unidad === 'libra' ? ' (lb)' : unidad === 'kilo' ? ' (kg)' : '';
}

function FormularioNuevoProducto({ onCreado }: { onCreado: (p: Producto) => void }) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [unidad, setUnidad] = useState<UnidadDeVenta>('unidad');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [ivaExento, setIvaExento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sinStockInicial = !((leerCantidad(stockInicial, unidad) ?? 0) > 0);
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), aCentavos(costoUnitario));
  const avisoFecha = sinStockInicial ? null : avisoDelVencimiento(fechaVencimiento);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const stock = stockInicial.trim() ? leerCantidad(stockInicial, unidad, true) : undefined;
    const minimo = stockMinimo.trim() ? leerCantidad(stockMinimo, unidad, true) : undefined;
    if (stock === null || minimo === null) {
      setError(
        porPeso(unidad)
          ? 'Revisa el stock: un número con hasta 3 decimales (por ejemplo 12,5).'
          : 'Revisa el stock: va en unidades enteras. Si se vende por peso, elige "Por libra" o "Por kilo".',
      );
      return;
    }
    setEnviando(true);
    try {
      // Los inputs son pesos/dólares "humanos" (ej. 1500.50); el backend
      // espera centavos enteros (ver sección 6.3 del spec: nunca floats).
      const producto = await crearProducto(token, {
        codigoBarras: codigoBarras.trim() || undefined,
        nombre,
        precioVentaCentavos: Math.round(parseFloat(precioVenta) * 100),
        costoUnitarioCentavos: costoUnitario
          ? Math.round(parseFloat(costoUnitario) * 100)
          : undefined,
        stockInicial: stock,
        stockMinimo: minimo,
        unidad,
        fechaVencimiento: (!sinStockInicial && fechaVencimiento) || undefined,
        ivaExento,
      });
      onCreado(producto);
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="field-label" htmlFor="producto-codigo">
            Código de barras <span className="font-normal normal-case">(opcional)</span>
          </label>
          <input
            id="producto-codigo"
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            className="field font-ticket"
            placeholder="7791234567890"
            aria-describedby="producto-codigo-ayuda"
          />
          <p id="producto-codigo-ayuda" className="-mt-2 mb-1 text-xs text-tinta-suave">
            Si no tiene (pan, huevos, lo suelto), déjalo vacío: al vender lo buscas por su nombre.
          </p>
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="producto-nombre">
            Nombre
          </label>
          <input
            id="producto-nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="field"
            placeholder="Coca Cola 500ml"
          />
        </div>
        <div className="col-span-2">
          <p className="field-label">Cómo se vende</p>
          <SelectorUnidad valor={unidad} onCambio={setUnidad} />
          {porPeso(unidad) && (
            <p className="mt-1.5 text-xs text-tinta-suave">
              Arroz, azúcar, queso: al vender se pone cuánto (media libra, 2 libras) o por cuánto
              dinero.
            </p>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="producto-precio">
            {etiquetaPor('Precio de venta', unidad)}
          </label>
          <input
            id="producto-precio"
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
          <label className="field-label" htmlFor="producto-costo">
            {unidad === 'unidad' ? 'Costo unitario' : etiquetaPor('Costo', unidad)}
          </label>
          <input
            id="producto-costo"
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
          <p className="aviso-advertencia col-span-2 -mt-2 text-xs" aria-live="polite">
            {avisoMargen}
          </p>
        )}
        <div className="col-span-2">
          <label className="field-label" htmlFor="producto-stock">
            Stock inicial{enUnidad(unidad)}
          </label>
          <input
            id="producto-stock"
            type="number"
            min="0"
            step={pasoDe(unidad)}
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
            className="field font-ticket"
            placeholder="20"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="producto-stock-minimo">
            Stock mínimo{enUnidad(unidad)} (opcional)
          </label>
          <input
            id="producto-stock-minimo"
            type="number"
            min="0"
            step={pasoDe(unidad)}
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className="field font-ticket"
            placeholder="5"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="producto-vencimiento">
            Vence el (opcional)
          </label>
          {/* La fecha es del stock inicial: sin unidades no hay qué venza. */}
          <input
            id="producto-vencimiento"
            type="date"
            value={sinStockInicial ? '' : fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            disabled={sinStockInicial}
            aria-describedby="producto-vencimiento-ayuda"
            className="field font-ticket disabled:opacity-50"
          />
          <AvisoDeCampo
            id="producto-vencimiento-ayuda"
            advertencia={avisoFecha}
            ayuda={sinStockInicial ? 'Primero carga el stock inicial.' : 'La del stock inicial.'}
          />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              checked={ivaExento}
              onChange={(e) => setIvaExento(e.target.checked)}
              className="h-4 w-4 rounded border-papel-linea"
            />
            Exento de IVA (alimentos básicos, medicinas, etc.)
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar producto'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

function FormularioEditarProducto({
  producto,
  onActualizado,
  onDadoDeBaja,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  onDadoDeBaja: (p: Producto) => void;
}) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [precioVenta, setPrecioVenta] = useState((producto.precioVentaCentavos / 100).toFixed(2));
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo.toString());
  const [unidad, setUnidad] = useState<UnidadDeVenta>(producto.unidad);
  const [fechaVencimiento, setFechaVencimiento] = useState(producto.fechaVencimiento ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const variosLotes = tieneVariosLotes(producto);
  const cambioLaFecha = !variosLotes && fechaVencimiento !== (producto.fechaVencimiento ?? '');
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), producto.costoUnitarioCentavos);

  async function darDeBaja() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      onDadoDeBaja(await darDeBajaProducto(token, producto.id));
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja el producto');
      setConfirmandoBaja(false);
    } finally {
      setEnviando(false);
    }
  }

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const minimo = stockMinimo.trim() ? leerCantidad(stockMinimo, unidad, true) : 0;
    if (minimo === null) {
      setError(
        porPeso(unidad)
          ? 'Revisa el stock mínimo: un número con hasta 3 decimales.'
          : 'Revisa el stock mínimo: va en unidades enteras.',
      );
      return;
    }
    setEnviando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        precioVentaCentavos: Math.round(parseFloat(precioVenta) * 100),
        stockMinimo: minimo,
        ...(unidad !== producto.unidad ? { unidad } : {}),
        // Solo si se tocó: con varios lotes la fecha no se edita acá.
        ...(cambioLaFecha
          ? {
              fechaVencimiento: fechaVencimiento || undefined,
              quitarFechaVencimiento: !fechaVencimiento,
            }
          : {}),
      });
      onActualizado(actualizado);
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      {/* Qué se está tocando, a la vista mientras se edita. */}
      <div className="ficha">
        <div className="ficha-dato">
          <span>Código</span>
          <strong className="truncate text-xs">{textoDelCodigo(producto.codigoBarras)}</strong>
        </div>
        <div className="ficha-dato">
          <span>Stock</span>
          <strong>{formatearCantidad(producto.stock, producto.unidad)}</strong>
        </div>
        <div className="ficha-dato">
          <span>Costo</span>
          <strong>
            {producto.costoUnitarioCentavos > 0
              ? formatearCentavos(producto.costoUnitarioCentavos)
              : '—'}
          </strong>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <p className="field-label">Cómo se vende</p>
          <SelectorUnidad valor={unidad} onCambio={setUnidad} />
        </div>
        <div>
          <label className="field-label" htmlFor={`editar-precio-${producto.id}`}>
            {etiquetaPor('Precio de venta', unidad)}
          </label>
          <input
            id={`editar-precio-${producto.id}`}
            required
            type="number"
            step="0.01"
            min="0"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            aria-describedby={`editar-precio-${producto.id}-aviso`}
            className="field font-ticket"
          />
          <AvisoDeCampo
            id={`editar-precio-${producto.id}-aviso`}
            advertencia={avisoMargen}
            ayuda={
              producto.costoUnitarioCentavos > 0
                ? `Costo: ${formatearCentavos(producto.costoUnitarioCentavos)}`
                : null
            }
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`editar-stock-minimo-${producto.id}`}>
            Stock mínimo{enUnidad(unidad)}
          </label>
          <input
            id={`editar-stock-minimo-${producto.id}`}
            type="number"
            min="0"
            step={pasoDe(unidad)}
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className="field font-ticket"
          />
        </div>
        <div className="col-span-2">
          {variosLotes ? (
            <>
              <p className="field-label">Vencimiento</p>
              <p className="text-sm text-tinta">{resumenDeLotes(producto)}</p>
              <p className="mt-1 text-xs text-tinta-suave">
                Tiene varias fechas: se corrigen en{' '}
                <Link href="/inventario#lotes" className="font-medium text-tinta underline">
                  Inventario → Lotes
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <label className="field-label" htmlFor={`editar-vencimiento-${producto.id}`}>
                Fecha de vencimiento
              </label>
              <input
                id={`editar-vencimiento-${producto.id}`}
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                aria-describedby={`editar-vencimiento-${producto.id}-aviso`}
                className="field font-ticket"
              />
              <AvisoDeCampo
                id={`editar-vencimiento-${producto.id}-aviso`}
                advertencia={cambioLaFecha ? avisoDelVencimiento(fechaVencimiento) : null}
                ayuda="Deja vacío para quitar la fecha."
              />
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      {/* Confirmación en dos pasos: la baja saca el producto de la caja,
          no conviene que un click perdido lo haga. */}
      {confirmandoBaja && (
        <div className="entra mt-4 rounded-xl border border-rojo-perdida/30 bg-rojo-perdida/5 p-3">
          <p className="text-sm text-tinta">
            <strong>{producto.nombre}</strong> dejará de aparecer en el catálogo y no se podrá
            vender. Sus ventas pasadas se conservan, y puedes reactivarlo después.
          </p>
        </div>
      )}

      <VentanaPie>
        {confirmandoBaja ? (
          <>
            <Button type="button" variant="danger" disabled={enviando} onClick={darDeBaja}>
              {enviando ? 'Dando de baja…' : 'Sí, dar de baja'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmandoBaja(false)}>
              No
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" variant="primary" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto !text-rojo-perdida"
              disabled={enviando}
              onClick={() => setConfirmandoBaja(true)}
            >
              Dar de baja
            </Button>
          </>
        )}
      </VentanaPie>
    </form>
  );
}

// ---------------------------------------------------------------------
// Cada dato de la lista con su contexto: no un número suelto, sino si
// está bien o hay que hacer algo (poco stock, vence pronto, se vende por
// debajo del costo).
// ---------------------------------------------------------------------

// Tonos para la ficha de cada producto: siempre el mismo para el mismo
// producto, así se reconoce de un vistazo en la lista.
const TONOS_FICHA = [
  { fondo: 'rgba(217, 140, 43, 0.16)', texto: '#9a5f14' },
  { fondo: 'rgba(47, 143, 176, 0.14)', texto: '#1f6a85' },
  { fondo: 'rgba(47, 111, 79, 0.14)', texto: '#2f6f4f' },
  { fondo: 'rgba(138, 99, 201, 0.14)', texto: '#6a45a8' },
  { fondo: 'rgba(182, 70, 47, 0.12)', texto: '#a03d28' },
  { fondo: 'rgba(28, 43, 58, 0.09)', texto: '#1c2b3a' },
];

function tonoDe(texto: string) {
  let suma = 0;
  for (const letra of texto) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return TONOS_FICHA[suma % TONOS_FICHA.length];
}

/** "Aceite La Favorita 1 L" → "AL": las dos primeras palabras con letras. */
function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return (palabras[0]?.[0] ?? '?').concat(palabras[1]?.[0] ?? '').toUpperCase();
}

/** Días desde hoy hasta la fecha 'AAAA-MM-DD' (negativo si ya pasó). */
function diasHasta(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(anio, mes - 1, dia).getTime() - hoy.getTime()) / 86_400_000);
}

/** El vencimiento como se lee de un vistazo, con su urgencia. */
function estadoDelVencimiento(fecha: string): {
  texto: string;
  tono: 'danger' | 'warning' | 'neutral';
} {
  const dias = diasHasta(fecha);
  if (dias < 0) return { texto: `Vencido · ${formatearFechaCorta(fecha)}`, tono: 'danger' };
  if (dias === 0) return { texto: 'Vence hoy', tono: 'danger' };
  if (dias === 1) return { texto: 'Vence mañana', tono: 'warning' };
  if (dias <= 7) return { texto: `Vence en ${dias} días`, tono: 'warning' };
  return { texto: formatearFechaCorta(fecha), tono: 'neutral' };
}

/** Iniciales, nombre y, debajo, lo que lo identifica. */
function FichaProducto({ producto }: { producto: Producto }) {
  const tono = tonoDe(producto.categoria || producto.nombre);
  const sinCodigo = esCodigoInterno(producto.codigoBarras);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="ficha-producto"
        style={{ background: tono.fondo, color: tono.texto }}
        aria-hidden
      >
        {iniciales(producto.nombre)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-tinta">{producto.nombre}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tinta-suave">
          {producto.categoria && <span>{producto.categoria}</span>}
          {sinCodigo ? (
            <span className="etiqueta-dato">Sin código</span>
          ) : (
            <span className="font-ticket">{producto.codigoBarras}</span>
          )}
          {porPeso(producto.unidad) && (
            <span className="etiqueta-dato etiqueta-dato-ambar">
              Por {producto.unidad === 'libra' ? 'libra' : 'kilo'}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** El precio y, para el dueño, el costo (con aviso si se pierde plata). */
function PrecioDelProducto({
  producto,
  alinear = 'derecha',
}: {
  producto: Producto;
  alinear?: 'derecha' | 'izquierda';
}) {
  // El cajero no recibe el costo: solo ve el precio.
  const costo = producto.costoUnitarioCentavos ?? 0;
  const pierde = costo > 0 && producto.precioVentaCentavos < costo;
  return (
    <div className={alinear === 'derecha' ? 'text-right' : ''}>
      <p className="font-ticket font-semibold text-tinta">
        {formatearCentavos(producto.precioVentaCentavos)}
        <span className="font-normal text-tinta-suave">{precioPor(producto.unidad)}</span>
      </p>
      {costo > 0 &&
        (pierde ? (
          <p className="mt-1">
            <span className="status-pill status-pill-danger">Bajo el costo</span>
          </p>
        ) : (
          <p className="mt-0.5 font-ticket text-[11px] text-tinta-suave">
            costo {formatearCentavos(costo)}
          </p>
        ))}
    </div>
  );
}

/**
 * El stock con su estado: agotado, bajo (llegó al mínimo) o bien, y una
 * barrita que muestra cuánto falta para el mínimo.
 */
function EstadoDelStock({
  producto,
  alinear = 'derecha',
}: {
  producto: Producto;
  alinear?: 'derecha' | 'izquierda';
}) {
  const { stock, stockMinimo, unidad } = producto;
  const estado = stock <= 0 ? 'agotado' : stockMinimo > 0 && stock <= stockMinimo ? 'bajo' : 'bien';
  // Lleno cuando hay el triple del mínimo; sin mínimo no hay con qué medir.
  const nivel = stockMinimo > 0 ? Math.min(1, stock / (stockMinimo * 3)) : null;
  return (
    <div className={`inline-flex flex-col gap-1 ${alinear === 'derecha' ? 'items-end' : ''}`}>
      <span className="flex items-center gap-2">
        {estado !== 'bien' && (
          <span
            className={`status-pill ${estado === 'agotado' ? 'status-pill-danger' : 'status-pill-warning'}`}
          >
            {estado === 'agotado' ? 'Agotado' : 'Bajo'}
          </span>
        )}
        <span className="font-ticket font-semibold text-tinta">
          {formatearCantidad(stock, unidad)}
        </span>
      </span>
      {nivel !== null && (
        <span
          className="flex items-center gap-1.5"
          title={`Mínimo: ${formatearCantidad(stockMinimo, unidad)}`}
        >
          <span className={`nivel-stock nivel-stock-${estado}`} aria-hidden>
            <span style={{ width: `${Math.max(4, nivel * 100)}%` }} />
          </span>
          <span className="font-ticket text-[10px] text-tinta-suave">
            mín {formatearCantidad(stockMinimo, unidad)}
          </span>
        </span>
      )}
    </div>
  );
}

// Editar la fecha desde acá evita el rodeo de abrir el formulario
// completo (Editar → buscar el campo → Guardar → Cancelar) cada vez que
// solo hace falta poner o cambiar una fecha — pensado para cuando hay
// que cargar varios productos seguidos.
function CeldaFechaVencimiento({
  producto,
  onActualizado,
  soloLectura,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  soloLectura: boolean;
}) {
  const { token } = useAuth();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(producto.fechaVencimiento ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(nuevaFecha: string) {
    if (!token) return;
    // Sin cambios: cerrar sin llamar al backend.
    if (nuevaFecha === (producto.fechaVencimiento ?? '')) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        fechaVencimiento: nuevaFecha || undefined,
        quitarFechaVencimiento: !nuevaFecha,
      });
      onActualizado(actualizado);
      setEditando(false);
    } catch (err) {
      // Si falla, dejamos el input abierto con el valor tal cual estaba
      // escrito para que la persona pueda reintentar sin perder lo tipeado.
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha');
    } finally {
      setGuardando(false);
    }
  }

  // Varias fechas: no hay "una" fecha que editar acá.
  if (tieneVariosLotes(producto)) {
    const estado = estadoDelVencimiento(producto.fechaVencimiento!);
    const texto = `${producto.lotes!.length} fechas · ${estado.texto.toLowerCase()}`;
    const clases = `status-pill status-pill-${estado.tono}`;
    return soloLectura ? (
      <span className={clases}>{texto}</span>
    ) : (
      <Link href="/inventario#lotes" title={resumenDeLotes(producto)} className={clases}>
        {texto}
      </Link>
    );
  }

  if (editando) {
    return (
      <span className="inline-flex flex-col items-end">
        <input
          type="date"
          autoFocus
          disabled={guardando}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => guardar(valor)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar(valor);
            if (e.key === 'Escape') setEditando(false);
          }}
          className="field font-ticket !py-1.5 !mb-0 text-right"
          aria-invalid={!!error}
        />
        {error && (
          <span role="alert" className="mt-1 max-w-56 text-right text-xs text-rojo-perdida">
            {error}
          </span>
        )}
      </span>
    );
  }

  const estado = producto.fechaVencimiento ? estadoDelVencimiento(producto.fechaVencimiento) : null;

  if (soloLectura) {
    return estado ? (
      <span className={`status-pill status-pill-${estado.tono}`}>{estado.texto}</span>
    ) : (
      <span className="text-xs text-tinta-suave">No vence</span>
    );
  }

  const abrir = () => {
    setValor(producto.fechaVencimiento ?? '');
    setEditando(true);
  };

  // Sin fecha: un botón discreto (antes, "Poner fecha" subrayado en casi
  // todas las filas parecía un error de cada producto).
  if (!estado) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="boton-fecha"
        aria-label={`Poner fecha de vencimiento a ${producto.nombre}`}
      >
        <PlusIcon className="h-3 w-3" />
        Fecha
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={abrir}
      title="Cambiar la fecha"
      className={`status-pill status-pill-${estado.tono} cursor-pointer hover:brightness-95`}
    >
      {estado.texto}
    </button>
  );
}

// Tocar la fila abre la edición, salvo que el toque haya sido en un
// botón o enlace de la fila (la fecha, por ejemplo, se edita ahí mismo).
const tocoAlgoAdentro = (e: MouseEvent) =>
  !!(e.target as HTMLElement).closest('button, a, input, select, label');

function BotonEditar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="boton-editar">
      <PencilIcon className="h-3 w-3" />
      Editar
    </button>
  );
}

function TablaProductos({
  productos,
  onEditar,
  onActualizado,
  soloLectura,
}: {
  soloLectura: boolean;
  productos: Producto[];
  onEditar: (p: Producto) => void;
  onActualizado: (p: Producto) => void;
}) {
  const pantallaChica = usePantallaChica();

  // En celular la tabla no entra (se cortaban Vence y Editar): tarjetas.
  if (pantallaChica) {
    return (
      <ul className="space-y-3">
        {productos.map((p) => (
          <li
            key={p.id}
            className={`app-card p-4 ${soloLectura ? '' : 'fila-tocable'}`}
            onClick={soloLectura ? undefined : (e) => !tocoAlgoAdentro(e) && onEditar(p)}
          >
            <div className="flex items-start justify-between gap-3">
              <FichaProducto producto={p} />
              <div className="shrink-0">
                <PrecioDelProducto producto={p} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-papel-linea pt-3">
              <EstadoDelStock producto={p} alinear="izquierda" />
              <div className="flex items-center gap-2">
                <CeldaFechaVencimiento
                  producto={p}
                  onActualizado={onActualizado}
                  soloLectura={soloLectura}
                />
                {!soloLectura && <BotonEditar onClick={() => onEditar(p)} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="table-shell">
      <table className="tabla-productos w-full table-fixed text-left text-sm">
        {/* Anchos fijos: el nombre necesita lugar; la fecha y la acción, poco. */}
        <colgroup>
          <col />
          <col className="w-32" />
          <col className="w-40" />
          <col className="w-44" />
          {!soloLectura && <col className="w-28" />}
        </colgroup>
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3 text-right">Precio</th>
            <th className="px-4 py-3 text-right">Stock</th>
            <th className="px-4 py-3 text-right">Vencimiento</th>
            {!soloLectura && (
              <th className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr
              key={p.id}
              className={`border-t border-papel-linea ${soloLectura ? '' : 'fila-tocable'}`}
              onClick={soloLectura ? undefined : (e) => !tocoAlgoAdentro(e) && onEditar(p)}
            >
              <td className="px-4 py-3">
                <FichaProducto producto={p} />
              </td>
              <td className="px-4 py-3 align-middle">
                <PrecioDelProducto producto={p} />
              </td>
              <td className="px-4 py-3 text-right align-middle">
                <EstadoDelStock producto={p} />
              </td>
              <td className="px-4 py-3 text-right align-middle">
                <CeldaFechaVencimiento
                  producto={p}
                  onActualizado={onActualizado}
                  soloLectura={soloLectura}
                />
              </td>
              {!soloLectura && (
                <td className="w-24 px-4 py-3 text-right">
                  <BotonEditar onClick={() => onEditar(p)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Los números del catálogo que importan, en la franja de arriba. */
function DatosDelCatalogo({ productos, esAdmin }: { productos: Producto[]; esAdmin: boolean }) {
  const agotados = productos.filter((p) => p.stock <= 0).length;
  const aReponer = productos.filter(porReponer).length;
  const porVencer = productos.filter(estaPorVencer).length;
  // A costo: lo que se pagó por lo que hay en la tienda (solo el dueño).
  const valorACosto = productos.reduce(
    (acc, p) => acc + Math.round((p.costoUnitarioCentavos ?? 0) * Math.max(0, p.stock)),
    0,
  );
  const valorAPrecio = productos.reduce(
    (acc, p) => acc + Math.round(p.precioVentaCentavos * Math.max(0, p.stock)),
    0,
  );
  return (
    <div className="banda-datos">
      {esAdmin && valorACosto > 0 && (
        <div className="banda-dato" title="Lo que pagaste por lo que hay en la tienda">
          <span className="banda-dato-etiqueta">Inventario a costo</span>
          <span className="banda-dato-valor">{formatearCentavos(valorACosto)}</span>
        </div>
      )}
      <div className="banda-dato" title="Lo que cobrarías si vendes todo lo que hay">
        <span className="banda-dato-etiqueta">Si vendes todo</span>
        <span className="banda-dato-valor">{formatearCentavos(valorAPrecio)}</span>
      </div>
      <div className={`banda-dato ${aReponer > 0 ? 'banda-dato-alerta' : ''}`}>
        <span className="banda-dato-etiqueta">Por reponer</span>
        <span className="banda-dato-valor">
          {aReponer}
          {agotados > 0 && (
            <span className="banda-dato-nota">
              {' '}
              · {agotados} agotado{agotados === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </div>
      <div className={`banda-dato ${porVencer > 0 ? 'banda-dato-alerta' : ''}`}>
        <span className="banda-dato-etiqueta">Vencen en 7 días</span>
        <span className="banda-dato-valor">{porVencer}</span>
      </div>
    </div>
  );
}

// Plegada por defecto y cargada recién al abrirla: es algo que se mira
// de vez en cuando, no en cada visita al catálogo.
function SeccionDadosDeBaja({
  dadosDeBaja,
  abierta,
  onAlternar,
  onReactivado,
}: {
  dadosDeBaja: Producto[] | null;
  abierta: boolean;
  onAlternar: () => void;
  onReactivado: (p: Producto) => void;
}) {
  const { token } = useAuth();
  const pantallaChica = usePantallaChica();
  const [reactivandoId, setReactivandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reactivar(producto: Producto) {
    if (!token) return;
    setError(null);
    setReactivandoId(producto.id);
    try {
      onReactivado(await reactivarProducto(token, producto.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reactivar el producto');
    } finally {
      setReactivandoId(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onAlternar}
        className="text-sm font-medium text-tinta-suave underline hover:text-tinta"
      >
        {abierta ? 'Ocultar productos dados de baja' : 'Ver productos dados de baja'}
      </button>

      {abierta && (
        <div className="mt-3 space-y-3">
          {error && (
            <p className="rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
              {error}
            </p>
          )}
          {dadosDeBaja === null && <LoadingState label="Cargando…" />}
          {dadosDeBaja?.length === 0 && (
            <p className="text-sm text-tinta-suave">No hay productos dados de baja.</p>
          )}
          {dadosDeBaja && dadosDeBaja.length > 0 && pantallaChica && (
            <ul className="space-y-2">
              {dadosDeBaja.map((p) => (
                <li key={p.id} className="app-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm text-tinta-suave">{p.nombre}</p>
                    <p className="font-ticket text-xs text-tinta-suave">
                      {textoDelCodigo(p.codigoBarras)} · stock{' '}
                      {formatearCantidad(p.stock, p.unidad)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reactivandoId !== null}
                    onClick={() => reactivar(p)}
                    className="shrink-0 text-xs font-medium text-tinta-suave underline hover:text-tinta disabled:opacity-50"
                  >
                    {reactivandoId === p.id ? 'Reactivando…' : 'Reactivar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dadosDeBaja && dadosDeBaja.length > 0 && !pantallaChica && (
            <div className="table-shell">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {dadosDeBaja.map((p) => (
                    <tr key={p.id} className="border-t border-papel-linea">
                      <td className="px-4 py-3 text-tinta-suave">{p.nombre}</td>
                      <td className="px-4 py-3 font-ticket text-xs text-tinta-suave">
                        {textoDelCodigo(p.codigoBarras)}
                      </td>
                      <td className="px-4 py-3 text-right font-ticket text-tinta-suave">
                        {formatearCantidad(p.stock, p.unidad)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={reactivandoId !== null}
                          onClick={() => reactivar(p)}
                          className="text-xs font-medium text-tinta-suave underline hover:text-tinta disabled:opacity-50"
                        >
                          {reactivandoId === p.id ? 'Reactivando…' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BarraBusqueda({
  productos,
  busqueda,
  onBusqueda,
  filtro,
  onFiltro,
}: {
  productos: Producto[];
  busqueda: string;
  onBusqueda: (v: string) => void;
  filtro: FiltroProductos;
  onFiltro: (f: FiltroProductos) => void;
}) {
  const opciones: { id: FiltroProductos; texto: string; cantidad?: number }[] = [
    { id: 'todos', texto: 'Todos' },
    {
      id: 'stock_bajo',
      texto: 'Por reponer',
      cantidad: productos.filter(porReponer).length,
    },
    {
      id: 'por_vencer',
      texto: 'Por vencer',
      cantidad: productos.filter(estaPorVencer).length,
    },
  ];
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        placeholder="Buscar por nombre o código"
        aria-label="Buscar productos"
        className="field !mb-0 md:max-w-sm"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar productos">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onFiltro(o.id)}
            aria-pressed={filtro === o.id}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtro === o.id
                ? 'border-tinta bg-tinta text-papel'
                : 'border-papel-linea bg-white/60 text-tinta-suave hover:text-tinta'
            }`}
          >
            {o.texto}
            {o.cantidad !== undefined && o.cantidad > 0 && (
              <span className="ml-1 font-ticket">{o.cantidad}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContenidoProductos() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  // null = todavía no se pidió (la sección arranca plegada).
  const [dadosDeBaja, setDadosDeBaja] = useState<Producto[] | null>(null);
  const [dadosDeBajaAbierta, setDadosDeBajaAbierta] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  // Una copia del producto (no su id): si se da de baja, la ventana puede
  // irse con su animación aunque ya no esté en la lista.
  const [editando, setEditando] = useState<Producto | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroProductos>('todos');
  const productosVisibles = filtrarProductos(productos, busqueda, filtro);

  function cargar() {
    if (!token) return;
    setCargando(true);
    setError(null);
    listarProductos(token)
      .then(setProductos)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo'),
      )
      .finally(() => setCargando(false));
  }

  function alternarDadosDeBaja() {
    const abrir = !dadosDeBajaAbierta;
    setDadosDeBajaAbierta(abrir);
    if (abrir && dadosDeBaja === null && token) {
      listarProductosDadosDeBaja(token)
        .then(setDadosDeBaja)
        .catch(() => setDadosDeBaja([]));
    }
  }

  function manejarDadoDeBaja(producto: Producto) {
    setProductos((prev) => prev.filter((p) => p.id !== producto.id));
    setDadosDeBaja((prev) => (prev ? [producto, ...prev] : prev));
  }

  function manejarReactivado(producto: Producto) {
    setDadosDeBaja((prev) => prev?.filter((p) => p.id !== producto.id) ?? prev);
    setProductos((prev) => [...prev, producto].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div>
      <Banda
        eyebrow="Catálogo"
        titulo="Productos"
        valor={productos.length > 0 ? String(productos.length) : undefined}
        detalle={
          productos.length > 0
            ? productos.length === 1
              ? 'producto activo en el catálogo'
              : 'productos activos en el catálogo'
            : esAdmin
              ? 'Carga tu primer producto para empezar a vender.'
              : 'Todavía no hay productos en el catálogo.'
        }
        extra={
          productos.length > 0 ? (
            <DatosDelCatalogo productos={productos} esAdmin={esAdmin} />
          ) : undefined
        }
        accion={
          esAdmin ? (
            <Button variant="claro" onClick={() => setNuevoAbierto(true)}>
              <PlusIcon className="h-4 w-4" />
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      <Hoja>
        <div className="mt-8 space-y-6">
          {nuevoAbierto && (
            <Ventana
              titulo="Nuevo producto"
              descripcion="Se suma al catálogo y ya se puede vender."
              icono={<PlusIcon className="h-5 w-5" />}
              onCerrar={() => setNuevoAbierto(false)}
            >
              <FormularioNuevoProducto onCreado={(p) => setProductos((prev) => [p, ...prev])} />
            </Ventana>
          )}

          {editando && (
            <Ventana
              titulo={editando.nombre}
              descripcion="Precio, stock mínimo y vencimiento."
              icono={<PencilIcon className="h-5 w-5" />}
              onCerrar={() => setEditando(null)}
            >
              <FormularioEditarProducto
                producto={editando}
                onActualizado={(actualizado) =>
                  setProductos((prev) =>
                    prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
                  )
                }
                onDadoDeBaja={manejarDadoDeBaja}
              />
            </Ventana>
          )}

          {cargando && <LoadingState label="Cargando catálogo…" />}

          {error && !cargando && (
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

          {!cargando && !error && productos.length === 0 && (
            <EmptyState
              icon={<BoxIcon className="h-6 w-6" />}
              title="Todavía no hay productos"
              description='Usa "Nuevo producto" para empezar a cargar tu catálogo.'
            />
          )}

          {!cargando && !error && productos.length > 0 && (
            <BarraBusqueda
              productos={productos}
              busqueda={busqueda}
              onBusqueda={setBusqueda}
              filtro={filtro}
              onFiltro={setFiltro}
            />
          )}

          {!cargando && !error && productos.length > 0 && productosVisibles.length === 0 && (
            <p className="text-sm text-tinta-suave">
              Ningún producto coincide.{' '}
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setFiltro('todos');
                }}
                className="font-medium text-tinta underline"
              >
                Ver todos
              </button>
            </p>
          )}

          {!cargando && !error && productosVisibles.length > 0 && (
            <TablaProductos
              productos={productosVisibles}
              soloLectura={!esAdmin}
              onEditar={setEditando}
              onActualizado={(actualizado) =>
                setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
              }
            />
          )}

          {!cargando && !error && esAdmin && (
            <SeccionDadosDeBaja
              dadosDeBaja={dadosDeBaja}
              abierta={dadosDeBajaAbierta}
              onAlternar={alternarDadosDeBaja}
              onReactivado={manejarReactivado}
            />
          )}
        </div>
      </Hoja>
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
