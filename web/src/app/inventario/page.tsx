'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import {
  AvisoDeCampo,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from '@/components/ui';
import { Banda, Hoja } from '@/components/banda';
import Link from 'next/link';
import { AlertIcon, BoxIcon, MinusIcon, PlusIcon, ReceiptIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import {
  corregirLotes,
  listarProductos,
  obtenerResumenInventarioDelDia,
  obtenerAlertas,
  registrarAbastecimiento,
  registrarMerma,
  ApiError,
  type FilaDeLote,
} from '@/lib/api';
import { formatearCentavos, formatearFechaCorta } from '@/lib/formato';
import { aCentavos, avisoDelMargen, avisoDelVencimiento } from '@/lib/validacion';
import {
  lotesPorVencer,
  lotesVencidos,
  resumenDeLotes,
  textoVencimiento,
  unidades,
} from '@/lib/lotes';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type AlertasProductos,
  type Lote,
  type MotivoMerma,
  type Producto,
  type ResumenMovimientosDelDia,
} from '@/lib/tipos';

// --- Resumen del día (egreso por abastecimiento + pérdida por merma) ---

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
  productoInicialId = '',
}: {
  productos: Producto[];
  onRegistrado: () => void;
  productoInicialId?: string;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState(productoInicialId);
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const elegido = productos.find((p) => p.id === productoId);
  const avisoCosto = elegido
    ? avisoDelMargen(elegido.precioVentaCentavos, aCentavos(costoUnitario))
    : null;

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
        fechaVencimiento: fechaVencimiento || undefined,
      });
      setProductoId('');
      setCantidad('');
      setCostoUnitario('');
      setProveedor('');
      setFechaVencimiento('');
      onRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abastecimiento');
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
              autoFocus={!!productoInicialId}
              id="abastecimiento-cantidad"
              required
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="field font-ticket"
              placeholder="Ej: 50"
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
              placeholder="Ej: 0.90"
            />
          </div>
          {/* Contra el precio al que se vende hoy: un costo mayor casi
              siempre es un precio mal tipeado (o hay que subir el de venta). */}
          {avisoCosto && elegido && (
            <p className="aviso-advertencia col-span-2 -mt-2 text-xs" aria-live="polite">
              {`Hoy lo vendés a ${formatearCentavos(elegido.precioVentaCentavos)}. ${avisoCosto}`}
            </p>
          )}
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
            placeholder="Ej: Distribuidora Central"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="abastecimiento-vence">
            Vence el (opcional)
          </label>
          <input
            id="abastecimiento-vence"
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            aria-describedby="abastecimiento-vence-aviso"
            className="field font-ticket"
          />
          {avisoDelVencimiento(fechaVencimiento) && (
            <p
              id="abastecimiento-vence-aviso"
              className="aviso-advertencia mt-1 text-xs"
              aria-live="polite"
            >
              {avisoDelVencimiento(fechaVencimiento)}
            </p>
          )}
          {/* Lo que ya hay en la góndola: si la mercadería nueva trae otra
              fecha, no se mezcla con esa. */}
          <p className="mt-1.5 text-xs text-tinta-suave">
            {elegido?.lotes && elegido.lotes.length > 0
              ? `Hoy hay ${resumenDeLotes(elegido)}. Si esta mercadería trae otra fecha, queda como un lote aparte y se vende después.`
              : 'Dejalo vacío si el producto no vence.'}
          </p>
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
  // '' = del que vence antes (lo mismo que hace una venta).
  const [loteId, setLoteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const producto = productos.find((p) => p.id === productoId);
  const lotes = producto?.lotes ?? [];
  const loteElegido = lotes.find((l) => l.id === loteId);
  // No se puede dar de baja más de lo que hay (el backend lo rechaza).
  const disponible = loteElegido?.cantidad ?? producto?.stock;
  const pedida = parseInt(cantidad, 10);
  const problemaCantidad =
    disponible !== undefined && pedida > disponible
      ? `Solo hay ${unidades(disponible)}${loteElegido ? ' en ese lote' : ''}.`
      : null;

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
        loteId: loteId || undefined,
      });
      setProductoId('');
      setCantidad('');
      setMotivo('vencido');
      setLoteId('');
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
            onChange={(id) => {
              setProductoId(id);
              setLoteId('');
            }}
          />
        </div>
        {lotes.length > 1 && (
          <div>
            <label className="field-label" htmlFor="merma-lote">
              De qué lote
            </label>
            <select
              id="merma-lote"
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
              className="field"
            >
              <option value="">El que vence antes</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {unidades(l.cantidad)} · {textoVencimiento(l)}
                </option>
              ))}
            </select>
          </div>
        )}
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
              max={disponible}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              aria-invalid={!!problemaCantidad}
              aria-describedby="merma-cantidad-aviso"
              className="field font-ticket"
              placeholder="Ej: 3"
            />
            <AvisoDeCampo id="merma-cantidad-aviso" error={problemaCantidad} />
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
        disabled={enviando || !productoId || !!problemaCantidad}
        className="mt-5 w-full"
      >
        {enviando ? 'Registrando…' : 'Registrar merma'}
      </Button>
    </form>
  );
}

// --- Alertas: vencidos + stock bajo + por vencer ---

/** Un lote vencido con el botón para darlo de baja (merma "vencido" de ese lote). */
function FilaVencido({
  producto,
  lote,
  puedeDarDeBaja,
  onDadoDeBaja,
}: {
  producto: Producto;
  lote: Lote;
  puedeDarDeBaja: boolean;
  onDadoDeBaja: () => void;
}) {
  const { token } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function darDeBaja() {
    if (!token) return;
    setEnviando(true);
    setError(null);
    try {
      await registrarMerma(token, {
        productoId: producto.id,
        cantidad: lote.cantidad,
        motivo: 'vencido',
        loteId: lote.id,
      });
      onDadoDeBaja();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja');
      setEnviando(false);
    }
  }

  return (
    <tr className="border-t border-papel-linea">
      <td className="px-4 py-3 text-tinta">
        {producto.nombre}
        <span className="block font-ticket text-xs text-rojo-perdida">
          {unidades(lote.cantidad)} · {textoVencimiento(lote)}
        </span>
        {error && <span className="block text-xs text-rojo-perdida">{error}</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {puedeDarDeBaja &&
          (confirmando ? (
            <span className="inline-flex flex-wrap justify-end gap-2">
              <Button variant="danger" onClick={darDeBaja} disabled={enviando}>
                {enviando ? 'Dando de baja…' : `Sí, dar de baja ${unidades(lote.cantidad)}`}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={enviando}>
                No
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="text-xs font-medium text-tinta underline"
            >
              Dar de baja
            </button>
          ))}
      </td>
    </tr>
  );
}

function TablaAlertas({
  alertas,
  onAbastecer,
  onCambio,
}: {
  alertas: AlertasProductos | null;
  onAbastecer?: (productoId: string) => void;
  onCambio: () => void;
}) {
  if (!alertas) return null;

  const sinAlertas =
    alertas.stockBajo.length === 0 &&
    alertas.porVencer.length === 0 &&
    alertas.vencidos.length === 0;

  if (sinAlertas) {
    return (
      <EmptyState
        icon={<AlertIcon className="h-6 w-6" />}
        title="Todo en orden"
        description="No hay alertas de stock bajo ni de vencimiento por ahora."
      />
    );
  }

  // Una fila por lote: de 18 leches pueden vencer 6 y las otras 12 no.
  const porVencer = alertas.porVencer.flatMap((p) =>
    lotesPorVencer(p).map((lote) => ({ producto: p, lote })),
  );
  const vencidos = alertas.vencidos.flatMap((p) =>
    lotesVencidos(p).map((lote) => ({ producto: p, lote })),
  );

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {vencidos.length > 0 && (
        <div className="table-shell sm:col-span-2">
          <div className="table-header flex items-center gap-1.5 px-4 py-2.5">
            <AlertIcon className="h-3.5 w-3.5 text-rojo-perdida" />
            Vencidos en la góndola
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {vencidos.map(({ producto, lote }) => (
                <FilaVencido
                  key={lote.id}
                  producto={producto}
                  lote={lote}
                  puedeDarDeBaja={!!onAbastecer}
                  onDadoDeBaja={onCambio}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    {onAbastecer && (
                      <button
                        type="button"
                        onClick={() => onAbastecer(p.id)}
                        className="ml-3 text-xs font-medium text-tinta underline"
                      >
                        Abastecer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {porVencer.length > 0 && (
        <div className="table-shell">
          <div className="table-header flex items-center gap-1.5 px-4 py-2.5">
            <AlertIcon className="h-3.5 w-3.5 text-rojo-perdida" />
            Por vencer
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {porVencer.map(({ producto, lote }) => (
                <tr key={lote.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">
                    {producto.nombre}
                    {/* Con varias fechas, cuántas son las que vencen. */}
                    {producto.stock !== lote.cantidad && (
                      <span className="block font-ticket text-xs text-tinta-suave">
                        {unidades(lote.cantidad)} de {producto.stock}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="status-pill status-pill-danger font-ticket">
                      {formatearFechaCorta(lote.fechaVencimiento!)}
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

// --- Lotes: cómo está repartido el stock entre fechas ---

interface FilaEditable extends FilaDeLote {
  clave: string;
}

/**
 * Corrección después de revisar la góndola ("hay 8 del 28 y 4 del 5, no
 * 6 y 6"). El total no cambia: si falta o sobra mercadería, es una merma
 * o un abastecimiento.
 */
function EditorLotes({
  producto,
  onGuardado,
  onCancelar,
}: {
  producto: Producto;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
  const [filas, setFilas] = useState<FilaEditable[]>(() =>
    (producto.lotes ?? []).map((l) => ({
      clave: l.id,
      id: l.id,
      fechaVencimiento: l.fechaVencimiento,
      cantidad: l.cantidad,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const suma = filas.reduce((acc, f) => acc + (Number.isFinite(f.cantidad) ? f.cantidad : 0), 0);
  const diferencia = suma - producto.stock;

  function cambiar(clave: string, cambios: Partial<FilaDeLote>) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!token || diferencia !== 0) return;
    setEnviando(true);
    setError(null);
    try {
      await corregirLotes(
        token,
        producto.id,
        filas.map(({ id, fechaVencimiento, cantidad }) => ({
          id,
          fechaVencimiento,
          cantidad,
        })),
      );
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los lotes');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-3 space-y-3 rounded-lg bg-papel p-3">
      {filas.map((fila, i) => (
        <div key={fila.clave} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="field-label" htmlFor={`lote-fecha-${fila.clave}`}>
              Vence el
            </label>
            <input
              id={`lote-fecha-${fila.clave}`}
              type="date"
              value={fila.fechaVencimiento ?? ''}
              onChange={(e) =>
                cambiar(fila.clave, {
                  fechaVencimiento: e.target.value || null,
                })
              }
              className="field font-ticket !mb-0"
              aria-describedby={fila.fechaVencimiento ? undefined : `lote-sin-${fila.clave}`}
            />
            {!fila.fechaVencimiento && (
              <span id={`lote-sin-${fila.clave}`} className="text-xs text-tinta-suave">
                Sin fecha
              </span>
            )}
          </div>
          <div className="w-24">
            <label className="field-label" htmlFor={`lote-cantidad-${fila.clave}`}>
              Unidades
            </label>
            <input
              id={`lote-cantidad-${fila.clave}`}
              type="number"
              min="0"
              required
              value={Number.isFinite(fila.cantidad) ? fila.cantidad : ''}
              onChange={(e) => cambiar(fila.clave, { cantidad: parseInt(e.target.value, 10) })}
              className="field font-ticket !mb-0"
            />
          </div>
          {!fila.id && (
            <Button
              variant="ghost"
              onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Quitar esta fecha"
            >
              Quitar
            </Button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setFilas((prev) => [
            ...prev,
            {
              clave: `nueva-${Date.now()}`,
              fechaVencimiento: null,
              cantidad: 0,
            },
          ])
        }
        className="text-xs font-medium text-tinta underline"
      >
        + Agregar otra fecha
      </button>

      <p
        className={`text-sm ${diferencia === 0 ? 'text-tinta-suave' : 'font-medium text-rojo-perdida'}`}
        role="status"
      >
        Suman {suma} de {producto.stock} en stock
        {diferencia > 0 && ` · sobran ${diferencia}`}
        {diferencia < 0 && ` · faltan ${-diferencia}`}.
        {diferencia !== 0 &&
          ' Si en la góndola hay otra cantidad, registrá la diferencia como merma o abastecimiento.'}
      </p>

      {error && (
        <p className="rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando || diferencia !== 0}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function SeccionLotes({ productos, onCambio }: { productos: Producto[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const conLotes = productos.filter((p) => (p.lotes?.length ?? 0) > 0);

  return (
    <div id="lotes" className="scroll-mt-24">
      <SectionHeader
        title="Lotes"
        description="Cuántas unidades vencen en cada fecha. Las ventas y las mermas descuentan primero lo que vence antes."
      />
      {conLotes.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-suave">
          Todavía ningún producto tiene fecha de vencimiento. Se carga al abastecer.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {conLotes.map((p) => (
            <li key={p.id} className={`app-card p-4 ${editando === p.id ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-tinta">{p.nombre}</p>
                  <p className="font-ticket text-xs text-tinta-suave">
                    {unidades(p.stock)} en stock
                  </p>
                </div>
                {editando !== p.id && (
                  <button
                    type="button"
                    onClick={() => setEditando(p.id)}
                    className="shrink-0 text-xs font-medium text-tinta underline"
                  >
                    Corregir
                  </button>
                )}
              </div>
              {editando === p.id ? (
                <EditorLotes
                  producto={p}
                  onGuardado={() => {
                    setEditando(null);
                    onCambio();
                  }}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {p.lotes!.map((l) => {
                    const vencido = lotesVencidos(p).includes(l);
                    const pronto = lotesPorVencer(p).includes(l);
                    return (
                      <li
                        key={l.id}
                        className={`status-pill font-ticket text-xs ${
                          vencido
                            ? 'status-pill-danger'
                            : pronto
                              ? 'status-pill-warning'
                              : 'status-pill-neutral'
                        }`}
                      >
                        {unidades(l.cantidad)} · {textoVencimiento(l)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
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
  // Producto elegido desde "Abastecer" en una alerta. `vez` fuerza a
  // rearmar el formulario aunque se toque dos veces el mismo producto.
  const [sugerido, setSugerido] = useState<{ id: string; vez: number } | null>(null);

  function abastecerDesdeAlerta(productoId: string) {
    setSugerido({ id: productoId, vez: Date.now() });
    requestAnimationFrame(() =>
      document
        .getElementById('formulario-abastecimiento')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

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
    <div>
      <Banda
        eyebrow="Control de stock"
        titulo="Inventario"
        valor={resumen ? formatearCentavos(resumen.egresoCentavos) : undefined}
        detalle={
          resumen
            ? `Gastado hoy en abastecimiento · ${formatearCentavos(resumen.perdidaCentavos)} perdidos por merma.`
            : 'Entradas y pérdidas de mercadería, y las alertas de tu catálogo.'
        }
        accion={
          <Link href="/inventario/historial" className="button button-claro">
            <ReceiptIcon className="h-4 w-4" />
            Historial
          </Link>
        }
      />

      <Hoja>
        <div className="mt-8">
          {cargando && <LoadingState label="Cargando inventario…" />}

          {error && !cargando && (
            <ErrorState
              action={
                <Button variant="secondary" onClick={cargarTodo}>
                  Reintentar
                </Button>
              }
            >
              {error}
            </ErrorState>
          )}

          {!cargando && !error && (
            <div className="space-y-8">
              {/* Las alertas van antes que los formularios: es lo que más se
                  consulta, y en el celular quedaban al fondo de la página. */}
              <div>
                <SectionHeader
                  title="Alertas"
                  description="Lo vencido que sigue en la góndola, el stock por debajo del mínimo y lo que vence pronto."
                />
                <div className="mt-4">
                  <TablaAlertas
                    alertas={alertas}
                    onAbastecer={esAdmin ? abastecerDesdeAlerta : undefined}
                    onCambio={cargarTodo}
                  />
                </div>
              </div>

              {esAdmin &&
                (productos.length === 0 ? (
                  <EmptyState
                    icon={<BoxIcon className="h-6 w-6" />}
                    title="Todavía no hay productos"
                    description="Agregá alguno en la sección Productos antes de registrar movimientos de inventario."
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div id="formulario-abastecimiento" className="scroll-mt-24">
                      <FormularioAbastecimiento
                        key={sugerido?.vez ?? 'inicial'}
                        productos={productos}
                        onRegistrado={cargarTodo}
                        productoInicialId={sugerido?.id}
                      />
                    </div>
                    <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
                  </div>
                ))}

              {esAdmin && productos.length > 0 && (
                <SeccionLotes productos={productos} onCambio={cargarTodo} />
              )}
            </div>
          )}
        </div>
      </Hoja>
    </div>
  );
}

export default function InventarioPage() {
  return (
    <RutaProtegida soloAdmin>
      <Nav />
      <ContenidoInventario />
    </RutaProtegida>
  );
}
