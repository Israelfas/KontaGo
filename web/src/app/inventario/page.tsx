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
import {
  AlertIcon,
  BoxIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
} from '@/components/icons';
import { Ventana, VentanaPie, useVentana } from '@/components/ventana';
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
import { Ficha } from '@/components/ficha';
import { estadoDelVencimiento } from '@/lib/vencimiento';
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
import {
  formatearCantidad,
  leerCantidad,
  pasoDe,
  porPeso,
  redondear,
  type UnidadDeVenta,
} from '@/lib/cantidad';

/** " (lb)" en la etiqueta si el producto va por peso. */
function enUnidad(unidad: UnidadDeVenta | undefined): string {
  return unidad === 'libra' ? ' (lb)' : unidad === 'kilo' ? ' (kg)' : '';
}

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
        Elige un producto…
      </option>
      {productos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} · stock {formatearCantidad(p.stock, p.unidad)}
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
  const { cerrar } = useVentana();
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
    const leida = leerCantidad(cantidad, elegido?.unidad);
    if (leida === null) {
      setError(
        porPeso(elegido?.unidad)
          ? 'Revisa la cantidad: mayor que 0, con hasta 3 decimales.'
          : 'Revisa la cantidad: va en unidades enteras.',
      );
      return;
    }
    setEnviando(true);
    try {
      await registrarAbastecimiento(token, {
        productoId,
        cantidad: leida,
        // Igual que en el alta de producto: el input es en dólares,
        // el backend espera centavos enteros.
        costoUnitarioCentavos: Math.round(parseFloat(costoUnitario) * 100),
        proveedor: proveedor || undefined,
        fechaVencimiento: fechaVencimiento || undefined,
      });
      onRegistrado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abastecimiento');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="space-y-4">
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
              Cantidad{enUnidad(elegido?.unidad)}
            </label>
            <input
              autoFocus={!!productoInicialId}
              id="abastecimiento-cantidad"
              required
              type="number"
              min={porPeso(elegido?.unidad) ? '0.001' : '1'}
              step={pasoDe(elegido?.unidad)}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="field font-ticket"
              placeholder="Ej: 50"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="abastecimiento-costo">
              {elegido?.unidad === 'libra'
                ? 'Costo por libra'
                : elegido?.unidad === 'kilo'
                  ? 'Costo por kilo'
                  : 'Costo unitario'}
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
              {`Hoy lo vendes a ${formatearCentavos(elegido.precioVentaCentavos)}. ${avisoCosto}`}
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
              : 'Déjalo vacío si el producto no vence.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}

      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando || !productoId}>
          {enviando ? 'Registrando…' : 'Registrar abastecimiento'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
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
  const { cerrar } = useVentana();
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
  const pedida = leerCantidad(cantidad, producto?.unidad) ?? NaN;
  const problemaCantidad =
    disponible !== undefined && pedida > disponible
      ? `Solo hay ${unidades(disponible)}${loteElegido ? ' en ese lote' : ''}.`
      : null;

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (!Number.isFinite(pedida)) {
      setError(
        porPeso(producto?.unidad)
          ? 'Revisa la cantidad: mayor que 0, con hasta 3 decimales.'
          : 'Revisa la cantidad: va en unidades enteras.',
      );
      return;
    }
    setEnviando(true);
    try {
      await registrarMerma(token, {
        productoId,
        cantidad: pedida,
        motivo,
        loteId: loteId || undefined,
      });
      onRegistrado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit}>
      <div className="space-y-4">
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
              Cantidad{enUnidad(producto?.unidad)}
            </label>
            <input
              id="merma-cantidad"
              required
              type="number"
              min={porPeso(producto?.unidad) ? '0.001' : '1'}
              step={pasoDe(producto?.unidad)}
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

      <VentanaPie>
        <Button
          type="submit"
          variant="danger"
          disabled={enviando || !productoId || !!problemaCantidad}
        >
          {enviando ? 'Registrando…' : 'Registrar merma'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </VentanaPie>
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
  const [confirmando, setConfirmando] = useState(false);

  return (
    <tr className="border-t border-papel-linea">
      <td className="px-4 py-3 text-tinta">
        {producto.nombre}
        <span className="block font-ticket text-xs text-rojo-perdida">
          {unidades(lote.cantidad)} · {textoVencimiento(lote)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {puedeDarDeBaja && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="inline-flex items-center gap-1 rounded-full bg-rojo-perdida/10 px-2.5 py-1 text-xs font-medium text-rojo-perdida transition-colors hover:bg-rojo-perdida/15"
          >
            Dar de baja
          </button>
        )}
        {confirmando && (
          <Ventana
            titulo="Dar de baja lo vencido"
            descripcion="Sale del stock como merma por vencimiento, valorizada a costo."
            icono={<MinusIcon className="h-5 w-5" />}
            tono="rojo"
            onCerrar={() => setConfirmando(false)}
          >
            <ConfirmarBajaVencido producto={producto} lote={lote} onDadoDeBaja={onDadoDeBaja} />
          </Ventana>
        )}
      </td>
    </tr>
  );
}

function ConfirmarBajaVencido({
  producto,
  lote,
  onDadoDeBaja,
}: {
  producto: Producto;
  lote: Lote;
  onDadoDeBaja: () => void;
}) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
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
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja');
      setEnviando(false);
    }
  }

  return (
    <div className="text-left">
      <div className="ficha !grid-cols-2">
        <div className="ficha-dato col-span-2">
          <span>Producto</span>
          <p className="text-sm font-medium text-tinta">{producto.nombre}</p>
        </div>
        <div className="ficha-dato">
          <span>Unidades</span>
          <strong>{lote.cantidad}</strong>
        </div>
        <div className="ficha-dato">
          <span>Venció</span>
          <strong className="text-rojo-perdida">
            {formatearFechaCorta(lote.fechaVencimiento!)}
          </strong>
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
      <VentanaPie>
        <Button variant="danger" onClick={darDeBaja} disabled={enviando}>
          {enviando ? 'Dando de baja…' : `Sí, dar de baja ${unidades(lote.cantidad)}`}
        </Button>
        <Button variant="ghost" onClick={cerrar} disabled={enviando}>
          Cancelar
        </Button>
      </VentanaPie>
    </div>
  );
}

/** "1 u. · vence en 3 días", "28 u. · vence 4 may 2027", "6 u. · sin fecha". */
function textoDelLote(lote: { cantidad: number; fechaVencimiento: string | null }): string {
  if (!lote.fechaVencimiento) return `${unidades(lote.cantidad)} · sin fecha`;
  const estado = estadoDelVencimiento(lote.fechaVencimiento);
  return `${unidades(lote.cantidad)} · ${
    estado.tono === 'neutral' ? `vence ${estado.texto}` : estado.texto.toLowerCase()
  }`;
}

/** Encabezado de un grupo de alertas, con cuántas son. */
function TituloAlerta({
  texto,
  cantidad,
  tono,
}: {
  texto: string;
  cantidad: number;
  tono: 'rojo' | 'ambar';
}) {
  return (
    <div className={`titulo-alerta titulo-alerta-${tono}`}>
      <AlertIcon className="h-3.5 w-3.5" />
      {texto}
      <span className="titulo-alerta-cantidad">{cantidad}</span>
    </div>
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
          <TituloAlerta texto="Vencidos en el estante" cantidad={vencidos.length} tono="rojo" />
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
          <TituloAlerta texto="Stock bajo" cantidad={alertas.stockBajo.length} tono="ambar" />
          <table className="w-full text-left text-sm">
            <tbody>
              {alertas.stockBajo.map((p) => (
                <tr key={p.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Ficha nombre={p.nombre} tamano="chica" />
                      <div className="min-w-0">
                        <p className="truncate text-tinta">{p.nombre}</p>
                        <p className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`nivel-stock ${p.stock <= 0 ? 'nivel-stock-agotado' : 'nivel-stock-bajo'}`}
                            aria-hidden
                          >
                            <span
                              style={{
                                width: `${Math.max(4, Math.min(1, p.stock / (p.stockMinimo * 3)) * 100)}%`,
                              }}
                            />
                          </span>
                          <span className="font-ticket text-[11px] text-tinta-suave">
                            quedan {formatearCantidad(p.stock, p.unidad)} · mín.{' '}
                            {formatearCantidad(p.stockMinimo, p.unidad)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onAbastecer && (
                      <button
                        type="button"
                        onClick={() => onAbastecer(p.id)}
                        className="boton-tarjeta"
                      >
                        <PlusIcon className="h-3 w-3" />
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
          <TituloAlerta texto="Por vencer" cantidad={porVencer.length} tono="ambar" />
          <table className="w-full text-left text-sm">
            <tbody>
              {porVencer.map(({ producto, lote }) => (
                <tr key={lote.id} className="border-t border-papel-linea">
                  <td className="px-4 py-3 text-tinta">
                    <div className="flex min-w-0 items-center gap-3">
                      <Ficha nombre={producto.nombre} tamano="chica" />
                      <div className="min-w-0">
                        <p className="truncate">{producto.nombre}</p>
                        {/* Con varias fechas, cuántas son las que vencen. */}
                        <span className="block font-ticket text-xs text-tinta-suave">
                          {producto.stock !== lote.cantidad
                            ? `${unidades(lote.cantidad)} de ${producto.stock}`
                            : unidades(lote.cantidad)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`status-pill status-pill-${estadoDelVencimiento(lote.fechaVencimiento!).tono}`}
                      title={formatearFechaCorta(lote.fechaVencimiento!)}
                    >
                      {estadoDelVencimiento(lote.fechaVencimiento!).texto}
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
function EditorLotes({ producto, onGuardado }: { producto: Producto; onGuardado: () => void }) {
  const { token } = useAuth();
  const { cerrar } = useVentana();
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
  const suma = redondear(
    filas.reduce((acc, f) => acc + (Number.isFinite(f.cantidad) ? f.cantidad : 0), 0),
  );
  const diferencia = redondear(suma - producto.stock);

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
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los lotes');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
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
              step={pasoDe(producto.unidad)}
              value={Number.isFinite(fila.cantidad) ? fila.cantidad : ''}
              onChange={(e) =>
                cambiar(fila.clave, {
                  cantidad: porPeso(producto.unidad)
                    ? redondear(parseFloat(e.target.value))
                    : parseInt(e.target.value, 10),
                })
              }
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
          ' Si en el estante hay otra cantidad, registra la diferencia como merma o abastecimiento.'}
      </p>

      {error && (
        <p className="rounded-lg bg-rojo-perdida/10 px-3 py-2 text-sm text-rojo-perdida">{error}</p>
      )}

      <VentanaPie>
        <Button type="submit" variant="primary" disabled={enviando || diferencia !== 0}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="ghost" onClick={cerrar} disabled={enviando}>
          Cancelar
        </Button>
      </VentanaPie>
    </form>
  );
}

function SeccionLotes({ productos, onCambio }: { productos: Producto[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<Producto | null>(null);
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
            <li key={p.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Ficha nombre={p.nombre} semilla={p.categoria || undefined} tamano="chica" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta">{p.nombre}</p>
                    <p className="font-ticket text-xs text-tinta-suave">
                      {unidades(p.stock)} en stock ·{' '}
                      {p.lotes!.length === 1 ? 'una fecha' : `${p.lotes!.length} fechas`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  className="boton-tarjeta shrink-0"
                >
                  <PencilIcon className="h-3 w-3" />
                  Corregir
                </button>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
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
                      {textoDelLote(l)}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <Ventana
          titulo={`Lotes de ${editando.nombre}`}
          descripcion={`Cuántas de las ${unidades(editando.stock)} vencen en cada fecha, según lo que hay en el estante.`}
          icono={<PencilIcon className="h-5 w-5" />}
          onCerrar={() => setEditando(null)}
        >
          <EditorLotes producto={editando} onGuardado={onCambio} />
        </Ventana>
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
  // Qué ventana está abierta. Abastecer desde una alerta la abre con el
  // producto ya elegido.
  const [abasteciendo, setAbasteciendo] = useState<{ productoId?: string } | null>(null);
  const [registrandoMerma, setRegistrandoMerma] = useState(false);

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
            ? 'Gastado hoy en mercadería (abastecimientos).'
            : 'Entradas y pérdidas de mercadería, y las alertas de tu catálogo.'
        }
        extra={
          resumen &&
          alertas && (
            <div className="banda-datos">
              <div
                className={`banda-dato ${resumen.perdidaCentavos > 0 ? 'banda-dato-alerta' : ''}`}
              >
                <span className="banda-dato-etiqueta">Perdido hoy por merma</span>
                <span className="banda-dato-valor">
                  {formatearCentavos(resumen.perdidaCentavos)}
                </span>
              </div>
              <div
                className={`banda-dato ${alertas.vencidos.length > 0 ? 'banda-dato-alerta' : ''}`}
              >
                <span className="banda-dato-etiqueta">Vencidos en el estante</span>
                <span className="banda-dato-valor">{alertas.vencidos.length}</span>
              </div>
              <div
                className={`banda-dato ${alertas.stockBajo.length > 0 ? 'banda-dato-alerta' : ''}`}
              >
                <span className="banda-dato-etiqueta">Stock bajo</span>
                <span className="banda-dato-valor">{alertas.stockBajo.length}</span>
              </div>
              <div
                className={`banda-dato ${alertas.porVencer.length > 0 ? 'banda-dato-alerta' : ''}`}
              >
                <span className="banda-dato-etiqueta">Vencen en 7 días</span>
                <span className="banda-dato-valor">{alertas.porVencer.length}</span>
              </div>
            </div>
          )
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
              {/* Las dos cosas que se hacen a diario, a un toque. Los formularios
                  se abren en una ventana: antes ocupaban media pantalla todo
                  el tiempo aunque no se usaran. */}
              {esAdmin && productos.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="accion-grande"
                    onClick={() => setAbasteciendo({})}
                  >
                    <span className="ventana-icono ventana-icono-verde">
                      <PlusIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-tinta">
                        Registrar abastecimiento
                      </span>
                      <span className="block text-xs text-tinta-suave">
                        Llegó mercadería: suma stock y actualiza el costo.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="accion-grande"
                    onClick={() => setRegistrandoMerma(true)}
                  >
                    <span className="ventana-icono ventana-icono-rojo">
                      <MinusIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-tinta">
                        Registrar merma
                      </span>
                      <span className="block text-xs text-tinta-suave">
                        Se venció, se rompió o se perdió: sale del stock.
                      </span>
                    </span>
                  </button>
                </div>
              )}

              <div>
                <SectionHeader
                  title="Alertas"
                  description="Lo vencido que sigue en el estante, el stock por debajo del mínimo y lo que vence pronto."
                />
                <div className="mt-4">
                  <TablaAlertas
                    alertas={alertas}
                    onAbastecer={
                      esAdmin ? (productoId) => setAbasteciendo({ productoId }) : undefined
                    }
                    onCambio={cargarTodo}
                  />
                </div>
              </div>

              {esAdmin &&
                (productos.length === 0 ? (
                  <EmptyState
                    icon={<BoxIcon className="h-6 w-6" />}
                    title="Todavía no hay productos"
                    description="Agrega alguno en la sección Productos antes de registrar movimientos de inventario."
                  />
                ) : (
                  <>
                    {abasteciendo && (
                      <Ventana
                        titulo="Abastecimiento"
                        descripcion="Suma stock y recalcula el costo promedio del producto."
                        icono={<PlusIcon className="h-5 w-5" />}
                        tono="verde"
                        onCerrar={() => setAbasteciendo(null)}
                      >
                        <FormularioAbastecimiento
                          productos={productos}
                          onRegistrado={cargarTodo}
                          productoInicialId={abasteciendo.productoId}
                        />
                      </Ventana>
                    )}
                    {registrandoMerma && (
                      <Ventana
                        titulo="Merma"
                        descripcion="Descuenta stock y valoriza la pérdida a costo, no a precio de venta."
                        icono={<MinusIcon className="h-5 w-5" />}
                        tono="rojo"
                        onCerrar={() => setRegistrandoMerma(false)}
                      >
                        <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
                      </Ventana>
                    )}
                  </>
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
