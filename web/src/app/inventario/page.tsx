'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionHeader,
} from '@/components/ui';
import { AlertIcon, BoxIcon, MinusIcon, PlusIcon } from '@/components/icons';
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

function TarjetasResumenInventario({
  resumen,
}: {
  resumen: ResumenMovimientosDelDia | null;
}) {
  if (!resumen) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MetricCard
        label="Gastado en abastecimiento hoy"
        value={formatearCentavos(resumen.egresoCentavos)}
        detail={`${resumen.cantidadAbastecimientos} ${
          resumen.cantidadAbastecimientos === 1 ? 'movimiento' : 'movimientos'
        }`}
        icon={<PlusIcon className="h-5 w-5" />}
      />
      <MetricCard
        label="Pérdida por merma hoy"
        value={formatearCentavos(resumen.perdidaCentavos)}
        detail={`${resumen.cantidadMermas} ${
          resumen.cantidadMermas === 1 ? 'movimiento' : 'movimientos'
        }`}
        icon={<MinusIcon className="h-5 w-5" />}
        tone="danger"
      />
    </div>
  );
}

// --- Selector de producto compartido por ambos formularios ---

function SelectorProducto({
  id,
  productos,
  value,
  onChange,
}: {
  id: string;
  productos: Producto[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      id={id}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field"
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
    <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="metric-icon !relative !z-auto !mt-0">
          <PlusIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-tinta">Abastecimiento</h2>
          <p className="text-xs text-tinta-suave">
            Suma stock y recalcula el costo promedio del producto.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="abastecimiento-producto">
            Producto
          </label>
          <SelectorProducto
            id="abastecimiento-producto"
            productos={productos}
            value={productoId}
            onChange={setProductoId}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="abastecimiento-cantidad">
              Cantidad
            </label>
            <input
              id="abastecimiento-cantidad"
              required
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="field font-ticket"
              placeholder="50"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="abastecimiento-costo">
              Costo unitario
            </label>
            <input
              id="abastecimiento-costo"
              required
              type="number"
              step="0.01"
              min="0"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              className="field font-ticket"
              placeholder="0.90"
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="abastecimiento-proveedor">
            Proveedor (opcional)
          </label>
          <input
            id="abastecimiento-proveedor"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            className="field"
            placeholder="Distribuidora Central"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={enviando || !productoId}
        className="mt-5 w-full"
      >
        {enviando ? 'Registrando…' : 'Registrar abastecimiento'}
      </Button>
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
    <form onSubmit={manejarSubmit} className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="metric-icon !relative !z-auto !mt-0 !bg-rojo-perdida/10 !text-rojo-perdida">
          <MinusIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-tinta">Merma</h2>
          <p className="text-xs text-tinta-suave">
            Descuenta stock y valoriza la pérdida a costo, no a precio de venta.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="merma-producto">
            Producto
          </label>
          <SelectorProducto
            id="merma-producto"
            productos={productos}
            value={productoId}
            onChange={setProductoId}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="merma-cantidad">
              Cantidad
            </label>
            <input
              id="merma-cantidad"
              required
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="field font-ticket"
              placeholder="3"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="merma-motivo">
              Motivo
            </label>
            <select
              id="merma-motivo"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoMerma)}
              className="field"
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
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="danger"
        disabled={enviando || !productoId}
        className="mt-5 w-full"
      >
        {enviando ? 'Registrando…' : 'Registrar merma'}
      </Button>
    </form>
  );
}

// --- Alertas: stock bajo + por vencer ---

function TablaAlertas({ alertas }: { alertas: AlertasProductos | null }) {
  if (!alertas) return null;

  const sinAlertas = alertas.stockBajo.length === 0 && alertas.porVencer.length === 0;

  if (sinAlertas) {
    return (
      <EmptyState
        icon={<AlertIcon className="h-6 w-6" />}
        title="Todo en orden"
        description="No hay alertas de stock bajo ni de vencimiento por ahora."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {alertas.stockBajo.length > 0 && (
        <div className="table-shell">
          <div className="table-header flex items-center gap-1.5 px-4 py-2.5">
            <AlertIcon className="h-3.5 w-3.5 text-ambar" />
            Stock bajo
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {alertas.stockBajo.map((p) => (
                <tr key={p.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">{p.nombre}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="status-pill status-pill-warning font-ticket">
                      {p.stock} / mín. {p.stockMinimo}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alertas.porVencer.length > 0 && (
        <div className="table-shell">
          <div className="table-header flex items-center gap-1.5 px-4 py-2.5">
            <AlertIcon className="h-3.5 w-3.5 text-rojo-perdida" />
            Por vencer
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {alertas.porVencer.map((p) => (
                <tr key={p.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">{p.nombre}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="status-pill status-pill-danger font-ticket">
                      {p.fechaVencimiento
                        ? new Date(p.fechaVencimiento + 'T00:00:00').toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </span>
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
    setError(null);
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
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el inventario');
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
    <div className="app-page">
      <div className="app-container">
        <PageHeader
          eyebrow="Control de stock"
          title="Inventario"
          description="Registrá entradas y pérdidas de mercadería, y revisá las alertas de tu catálogo."
        />

        <div className="mt-8">
          {cargando && <LoadingState label="Cargando inventario…" />}

          {error && !cargando && (
            <ErrorState action={<Button variant="secondary" onClick={cargarTodo}>Reintentar</Button>}>
              {error}
            </ErrorState>
          )}

          {!cargando && !error && (
            <div className="space-y-8">
              <TarjetasResumenInventario resumen={resumen} />

              {esAdmin &&
                (productos.length === 0 ? (
                  <EmptyState
                    icon={<BoxIcon className="h-6 w-6" />}
                    title="Todavía no hay productos"
                    description="Agregá alguno en la sección Productos antes de registrar movimientos de inventario."
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <FormularioAbastecimiento productos={productos} onRegistrado={cargarTodo} />
                    <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
                  </div>
                ))}

              <div>
                <SectionHeader
                  title="Alertas"
                  description="Stock por debajo del mínimo y productos próximos a vencer."
                />
                <div className="mt-4">
                  <TablaAlertas alertas={alertas} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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