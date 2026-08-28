'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { BoxIcon, PlusIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { listarProductos, crearProducto, actualizarProducto, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
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
  onCerrar,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
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

      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
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
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
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
    ? new Date(producto.fechaVencimiento + 'T00:00:00').toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
      })
    : null;

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
  onCerrarEdicion,
}: {
  productos: Producto[];
  productoEditandoId: string | null;
  onEditar: (id: string) => void;
  onActualizado: (p: Producto) => void;
  onCerrarEdicion: () => void;
}) {
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
              <th className="px-4 py-3" />
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
                    <CeldaFechaVencimiento producto={p} onActualizado={onActualizado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEditar(p.id)}
                      className="text-xs font-medium text-tinta-suave underline hover:text-tinta"
                    >
                      Editar
                    </button>
                  </td>
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
              onCerrar={onCerrarEdicion}
            />
          );
        })()}
    </div>
  );
}

function ContenidoProductos() {
  const { token } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [productoEditandoId, setProductoEditandoId] = useState<string | null>(null);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="app-page">
      <div className="app-container">
        <PageHeader
          eyebrow="Catálogo"
          title="Productos"
          description="Gestioná los artículos de tu tienda: precio, costo y stock."
          action={
            !formularioAbierto && (
              <Button variant="primary" onClick={() => setFormularioAbierto(true)}>
                <PlusIcon className="h-4 w-4" />
                Nuevo producto
              </Button>
            )
          }
        />

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
            <TablaProductos
              productos={productos}
              productoEditandoId={productoEditandoId}
              onEditar={(id) => setProductoEditandoId(id)}
              onActualizado={(actualizado) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
                )
              }
              onCerrarEdicion={() => setProductoEditandoId(null)}
            />
          )}
        </div>
      </div>
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