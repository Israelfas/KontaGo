'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import { BoxIcon, PlusIcon } from '@/components/icons';
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
import { usePantallaChica } from '@/lib/use-pantalla-chica';
import {
  estaPorVencer,
  filtrarProductos,
  tieneStockBajo,
  type FiltroProductos,
} from '@/lib/filtro-productos';
import type { Producto } from '@/lib/tipos';

function FormularioNuevoProducto({
  onCreado,
  onCerrar,
}: {
  onCreado: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [ivaExento, setIvaExento] = useState(false);
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
        stockMinimo: stockMinimo ? parseInt(stockMinimo, 10) : undefined,
        fechaVencimiento: fechaVencimiento || undefined,
        ivaExento,
      });
      onCreado(producto);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="field-label" htmlFor="producto-codigo">
            Código de barras
          </label>
          <input
            id="producto-codigo"
            required
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            className="field font-ticket"
            placeholder="7791234567890"
          />
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
        <div>
          <label className="field-label" htmlFor="producto-precio">
            Precio de venta
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
            Costo unitario
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
        <div className="col-span-2">
          <label className="field-label" htmlFor="producto-stock">
            Stock inicial
          </label>
          <input
            id="producto-stock"
            type="number"
            min="0"
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
            className="field font-ticket"
            placeholder="20"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="producto-stock-minimo">
            Stock mínimo (opcional)
          </label>
          <input
            id="producto-stock-minimo"
            type="number"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className="field font-ticket"
            placeholder="5"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="producto-vencimiento">
            Fecha de vencimiento (opcional)
          </label>
          <input
            id="producto-vencimiento"
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            className="field font-ticket"
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

      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar producto'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FormularioEditarProducto({
  producto,
  onActualizado,
  onDadoDeBaja,
  onCerrar,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  onDadoDeBaja: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [precioVenta, setPrecioVenta] = useState(
    (producto.precioVentaCentavos / 100).toString(),
  );
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo.toString());
  const [fechaVencimiento, setFechaVencimiento] = useState(
    producto.fechaVencimiento ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  async function darDeBaja() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      onDadoDeBaja(await darDeBajaProducto(token, producto.id));
      onCerrar();
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
    setEnviando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        precioVentaCentavos: Math.round(parseFloat(precioVenta) * 100),
        stockMinimo: stockMinimo ? parseInt(stockMinimo, 10) : 0,
        fechaVencimiento: fechaVencimiento || undefined,
        quitarFechaVencimiento: !fechaVencimiento,
      });
      onActualizado(actualizado);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="app-card p-4 sm:p-5">
      <p className="text-sm font-semibold text-tinta">Editando: {producto.nombre}</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor={`editar-precio-${producto.id}`}>
            Precio de venta
          </label>
          <input
            id={`editar-precio-${producto.id}`}
            required
            type="number"
            step="0.01"
            min="0"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            className="field font-ticket"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`editar-stock-minimo-${producto.id}`}>
            Stock mínimo
          </label>
          <input
            id={`editar-stock-minimo-${producto.id}`}
            type="number"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className="field font-ticket"
          />
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor={`editar-vencimiento-${producto.id}`}>
            Fecha de vencimiento
          </label>
          <input
            id={`editar-vencimiento-${producto.id}`}
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            className="field font-ticket"
          />
          <p className="mt-1 text-xs text-tinta-suave">Dejá vacío para quitar la fecha.</p>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
        {!confirmandoBaja && (
          <Button
            type="button"
            variant="ghost"
            className="sm:ml-auto"
            disabled={enviando}
            onClick={() => setConfirmandoBaja(true)}
          >
            Dar de baja
          </Button>
        )}
      </div>

      {/* Confirmación en dos pasos: la baja saca el producto de la caja,
          no conviene que un click perdido lo haga. */}
      {confirmandoBaja && (
        <div className="mt-4 rounded-lg border border-rojo-perdida/30 bg-rojo-perdida/5 p-3">
          <p className="text-sm text-tinta">
            <strong>{producto.nombre}</strong> dejará de aparecer en el catálogo y no se podrá
            vender. Sus ventas pasadas se conservan, y podés reactivarlo después.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="danger" disabled={enviando} onClick={darDeBaja}>
              {enviando ? 'Dando de baja…' : 'Sí, dar de baja'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmandoBaja(false)}>
              No
            </Button>
          </div>
        </div>
      )}
    </form>
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

  async function guardar(nuevaFecha: string) {
    if (!token) return;
    setGuardando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        fechaVencimiento: nuevaFecha || undefined,
        quitarFechaVencimiento: !nuevaFecha,
      });
      onActualizado(actualizado);
      setEditando(false);
    } catch {
      // Si falla, dejamos el input abierto con el valor tal cual estaba
      // escrito para que la persona pueda reintentar sin perder lo tipeado.
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
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
      />
    );
  }

  const fechaLegible = producto.fechaVencimiento
    ? formatearFechaCorta(producto.fechaVencimiento)
    : null;

  if (soloLectura) {
    return <span className="font-ticket text-xs text-tinta-suave">{fechaLegible ?? '—'}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(producto.fechaVencimiento ?? '');
        setEditando(true);
      }}
      className="font-ticket text-xs text-tinta-suave underline decoration-dotted hover:text-tinta"
    >
      {fechaLegible ?? 'Poner fecha'}
    </button>
  );
}

function TablaProductos({
  productos,
  productoEditandoId,
  onEditar,
  onActualizado,
  onDadoDeBaja,
  onCerrarEdicion,
  soloLectura,
}: {
  soloLectura: boolean;
  productos: Producto[];
  productoEditandoId: string | null;
  onEditar: (id: string) => void;
  onActualizado: (p: Producto) => void;
  onDadoDeBaja: (p: Producto) => void;
  onCerrarEdicion: () => void;
}) {
  const pantallaChica = usePantallaChica();

  // En celular la tabla no entra (se cortaban Vence y Editar): tarjetas,
  // y la edición se abre en el lugar del producto, no al final de la lista.
  if (pantallaChica) {
    return (
      <ul className="space-y-3">
        {productos.map((p) => {
          if (!soloLectura && p.id === productoEditandoId) {
            return (
              <li key={p.id}>
                <FormularioEditarProducto
                  producto={p}
                  onActualizado={onActualizado}
                  onDadoDeBaja={onDadoDeBaja}
                  onCerrar={onCerrarEdicion}
                />
              </li>
            );
          }
          const stockBajo = p.stock <= p.stockMinimo && p.stockMinimo > 0;
          return (
            <li key={p.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-tinta">{p.nombre}</p>
                  <p className="font-ticket text-xs text-tinta-suave">{p.codigoBarras}</p>
                </div>
                <p className="shrink-0 font-ticket font-semibold text-tinta">
                  {formatearCentavos(p.precioVentaCentavos)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tinta-suave">
                {stockBajo ? (
                  <span className="status-pill status-pill-warning font-ticket">
                    Stock {p.stock} · bajo
                  </span>
                ) : (
                  <span className="font-ticket">Stock {p.stock}</span>
                )}
                <span className="flex items-center gap-1">
                  Vence
                  <CeldaFechaVencimiento
                    producto={p}
                    onActualizado={onActualizado}
                    soloLectura={soloLectura}
                  />
                </span>
                {!soloLectura && (
                  <button
                    type="button"
                    onClick={() => onEditar(p.id)}
                    className="ml-auto text-xs font-medium text-tinta-suave underline hover:text-tinta"
                  >
                    Editar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <div className="table-shell">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Vence</th>
              {!soloLectura && <th className="px-4 py-3" />}
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
                  <td className="px-4 py-3 text-right">
                    {stockBajo ? (
                      <span className="status-pill status-pill-warning font-ticket">
                        {p.stock}
                      </span>
                    ) : (
                      <span className="font-ticket text-tinta">{p.stock}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CeldaFechaVencimiento
                      producto={p}
                      onActualizado={onActualizado}
                      soloLectura={soloLectura}
                    />
                  </td>
                  {!soloLectura && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEditar(p.id)}
                        className="text-xs font-medium text-tinta-suave underline hover:text-tinta"
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {productoEditandoId &&
        (() => {
          const producto = productos.find((p) => p.id === productoEditandoId);
          if (!producto) return null;
          return (
            <FormularioEditarProducto
              producto={producto}
              onActualizado={onActualizado}
              onDadoDeBaja={onDadoDeBaja}
              onCerrar={onCerrarEdicion}
            />
          );
        })()}
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
                      {p.codigoBarras} · stock {p.stock}
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
                        {p.codigoBarras}
                      </td>
                      <td className="px-4 py-3 text-right font-ticket text-tinta-suave">
                        {p.stock}
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
    { id: 'stock_bajo', texto: 'Stock bajo', cantidad: productos.filter(tieneStockBajo).length },
    { id: 'por_vencer', texto: 'Por vencer', cantidad: productos.filter(estaPorVencer).length },
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
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [productoEditandoId, setProductoEditandoId] = useState<string | null>(null);
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
    setProductos((prev) =>
      [...prev, producto].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
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
            ? `${productos.length === 1 ? 'producto activo' : 'productos activos'}${
                productos.filter(tieneStockBajo).length > 0
                  ? ` · ${productos.filter(tieneStockBajo).length} con stock bajo`
                  : ''
              }`
            : esAdmin
              ? 'Cargá tu primer producto para empezar a vender.'
              : 'Todavía no hay productos en el catálogo.'
        }
        accion={
          esAdmin && !formularioAbierto ? (
            <Button variant="claro" onClick={() => setFormularioAbierto(true)}>
              <PlusIcon className="h-4 w-4" />
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      <Hoja>
        <div className="mt-8 space-y-6">
          {formularioAbierto && (
            <FormularioNuevoProducto
              onCreado={(p) => setProductos((prev) => [p, ...prev])}
              onCerrar={() => setFormularioAbierto(false)}
            />
          )}

          {cargando && <LoadingState label="Cargando catálogo…" />}

          {error && !cargando && (
            <ErrorState action={<Button variant="secondary" onClick={cargar}>Reintentar</Button>}>
              {error}
            </ErrorState>
          )}

          {!cargando && !error && productos.length === 0 && (
            <EmptyState
              icon={<BoxIcon className="h-6 w-6" />}
              title="Todavía no hay productos"
              description='Usá "Nuevo producto" para empezar a cargar tu catálogo.'
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
              productoEditandoId={productoEditandoId}
              onEditar={(id) => setProductoEditandoId(id)}
              onActualizado={(actualizado) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
                )
              }
              onDadoDeBaja={manejarDadoDeBaja}
              onCerrarEdicion={() => setProductoEditandoId(null)}
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