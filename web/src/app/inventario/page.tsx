'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth-context';
import {
  listarProductos,
  obtenerResumenInventarioDelDia,
  obtenerAlertas,
  registrarAbastecimiento,
  registrarMerma,
  ApiError,
} from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type AlertasProductos,
  type MotivoMerma,
  type Producto,
  type ResumenMovimientosDelDia,
} from '@/lib/tipos';

// --- Resumen del día (egreso por abastecimiento + pérdida por merma) ---

function TarjetaResumenInventario({
  resumen,
}: {
  resumen: ResumenMovimientosDelDia | null;
}) {
  if (!resumen) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-papel-linea bg-white/60 p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
          Gastado en abastecimiento hoy
        </span>
        <p className="mt-2 font-ticket text-xl font-semibold text-tinta">
          {formatearCentavos(resumen.egresoCentavos)}
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          {resumen.cantidadAbastecimientos}{' '}
          {resumen.cantidadAbastecimientos === 1 ? 'movimiento' : 'movimientos'}
        </p>
      </div>
      <div className="rounded-lg border border-papel-linea bg-white/60 p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
          Pérdida por merma hoy
        </span>
        <p className="mt-2 font-ticket text-xl font-semibold text-rojo-perdida">
          {formatearCentavos(resumen.perdidaCentavos)}
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          {resumen.cantidadMermas}{' '}
          {resumen.cantidadMermas === 1 ? 'movimiento' : 'movimientos'}
        </p>
      </div>
    </div>
  );
}

// --- Selector de producto compartido por ambos formularios ---

function SelectorProducto({
  productos,
  value,
  onChange,
}: {
  productos: Producto[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
    >
      <option value="" disabled>
        Elegí un producto…
      </option>
      {productos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} · stock {p.stock}
        </option>
      ))}
    </select>
  );
}

// --- Formulario de abastecimiento ---

function FormularioAbastecimiento({
  productos,
  onRegistrado,
}: {
  productos: Producto[];
  onRegistrado: () => void;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await registrarAbastecimiento(token, {
        productoId,
        cantidad: parseInt(cantidad, 10),
        // Igual que en el alta de producto: el input es en dólares,
        // el backend espera centavos enteros.
        costoUnitarioCentavos: Math.round(parseFloat(costoUnitario) * 100),
        proveedor: proveedor || undefined,
      });
      setProductoId('');
      setCantidad('');
      setCostoUnitario('');
      setProveedor('');
      onRegistrado();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo registrar el abastecimiento',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={manejarSubmit}
      className="rounded-lg border border-papel-linea bg-white/60 p-5"
    >
      <h2 className="font-display text-base font-semibold text-tinta">
        Abastecimiento
      </h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Suma stock y recalcula el costo promedio del producto.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Producto
          </label>
          <SelectorProducto
            productos={productos}
            value={productoId}
            onChange={setProductoId}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
              Cantidad
            </label>
            <input
              required
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
              placeholder="50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
              Costo unitario
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
              placeholder="900.00"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Proveedor (opcional)
          </label>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
            placeholder="Distribuidora Central"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || !productoId}
        className="mt-4 rounded-md bg-tinta px-4 py-2 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar abastecimiento'}
      </button>
    </form>
  );
}

// --- Formulario de merma ---

const MOTIVOS: MotivoMerma[] = ['vencido', 'danado', 'robado', 'otro'];

function FormularioMerma({
  productos,
  onRegistrado,
}: {
  productos: Producto[];
  onRegistrado: () => void;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState<MotivoMerma>('vencido');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await registrarMerma(token, {
        productoId,
        cantidad: parseInt(cantidad, 10),
        motivo,
      });
      setProductoId('');
      setCantidad('');
      setMotivo('vencido');
      onRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={manejarSubmit}
      className="rounded-lg border border-papel-linea bg-white/60 p-5"
    >
      <h2 className="font-display text-base font-semibold text-tinta">Merma</h2>
      <p className="mt-1 text-xs text-tinta-suave">
        Descuenta stock y valoriza la pérdida a costo, no a precio de venta.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
            Producto
          </label>
          <SelectorProducto
            productos={productos}
            value={productoId}
            onChange={setProductoId}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
              Cantidad
            </label>
            <input
              required
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 font-ticket text-sm text-tinta outline-none focus:border-tinta"
              placeholder="3"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">
              Motivo
            </label>
            <select
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoMerma)}
              className="w-full rounded-md border border-papel-linea bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-tinta"
            >
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETAS_MOTIVO_MERMA[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || !productoId}
        className="mt-4 rounded-md bg-rojo-perdida px-4 py-2 text-sm font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar merma'}
      </button>
    </form>
  );
}

// --- Alertas: stock bajo + por vencer ---

function TablaAlertas({ alertas }: { alertas: AlertasProductos | null }) {
  if (!alertas) return null;

  const sinAlertas =
    alertas.stockBajo.length === 0 && alertas.porVencer.length === 0;

  if (sinAlertas) {
    return (
      <p className="text-sm text-tinta-suave">
        No hay alertas de stock bajo ni de vencimiento por ahora.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {alertas.stockBajo.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-papel-linea">
          <div className="bg-ambar/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-ambar">
            Stock bajo
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {alertas.stockBajo.map((p) => (
                <tr key={p.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">{p.nombre}</td>
                  <td className="px-4 py-3 text-right font-ticket font-semibold text-ambar">
                    {p.stock} / mín. {p.stockMinimo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alertas.porVencer.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-papel-linea">
          <div className="bg-rojo-perdida/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-rojo-perdida">
            Por vencer
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {alertas.porVencer.map((p) => (
                <tr key={p.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">{p.nombre}</td>
                  <td className="px-4 py-3 text-right font-ticket text-rojo-perdida">
                    {p.fechaVencimiento
                      ? new Date(p.fechaVencimiento + 'T00:00:00').toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Contenido principal ---

function ContenidoInventario() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [productos, setProductos] = useState<Producto[]>([]);
  const [resumen, setResumen] = useState<ResumenMovimientosDelDia | null>(null);
  const [alertas, setAlertas] = useState<AlertasProductos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargarTodo() {
    if (!token) return;
    try {
      const [productosResp, resumenResp, alertasResp] = await Promise.all([
        listarProductos(token),
        obtenerResumenInventarioDelDia(token),
        obtenerAlertas(token),
      ]);
      setProductos(productosResp);
      setResumen(resumenResp);
      setAlertas(alertasResp);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo cargar el inventario',
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">
        Inventario
      </h1>

      {cargando && (
        <p className="mt-8 font-ticket text-sm text-tinta-suave">Cargando…</p>
      )}

      {error && (
        <p className="mt-8 rounded-md bg-rojo-perdida/10 px-4 py-3 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      {!cargando && !error && (
        <div className="mt-8 grid gap-8">
          <TarjetaResumenInventario resumen={resumen} />

          {esAdmin &&
            (productos.length === 0 ? (
              <p className="text-sm text-tinta-suave">
                Todavía no hay productos cargados. Agregá alguno en
                &ldquo;Productos&rdquo; antes de registrar movimientos.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <FormularioAbastecimiento productos={productos} onRegistrado={cargarTodo} />
                <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
              </div>
            ))}

          <div>
            <h2 className="font-display text-base font-semibold text-tinta">
              Alertas
            </h2>
            <div className="mt-3">
              <TablaAlertas alertas={alertas} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventarioPage() {
  return (
    <RutaProtegida>
      <Nav />
      <ContenidoInventario />
    </RutaProtegida>
  );
}