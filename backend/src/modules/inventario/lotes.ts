import { EntityManager } from 'typeorm';
import { Lote } from './entities/lote.entity';
import { Producto } from '../productos/entities/producto.entity';
import { VentaItemLote } from '../ventas/entities/venta-item-lote.entity';
import {
  LoteDeOtroProductoError,
  LotesNoSumanElStockError,
  StockDelLoteInsuficienteError,
} from './inventario.errors';

/**
 * Lotes por fecha de vencimiento. Todo lo de acá se llama DENTRO de una
 * transacción que ya bloqueó la fila del producto (pessimistic_write):
 * ese bloqueo es el que ordena los cambios sobre sus lotes, así que los
 * lotes no se bloquean aparte.
 *
 * Invariante: si un producto tiene lotes, la suma de sus cantidades es
 * igual a producto.stock. Por eso cada función que cambia lotes recibe la
 * cantidad que el llamador suma o resta del stock, y producto.stock lo
 * ajusta el llamador (como siempre).
 */

// --- Lógica pura (sin base de datos; ver lotes.spec.ts) ---

export interface LoteFEFO {
  id: string;
  fechaVencimiento: string | null;
  cantidad: number;
  createdAt: Date;
}

/** Primero lo que vence antes; los sin fecha al final; a igual fecha, el más viejo. */
export function ordenFEFO(a: LoteFEFO, b: LoteFEFO): number {
  if (a.fechaVencimiento !== b.fechaVencimiento) {
    if (a.fechaVencimiento === null) return 1;
    if (b.fechaVencimiento === null) return -1;
    return a.fechaVencimiento < b.fechaVencimiento ? -1 : 1;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Cuánto sacar de cada lote para `cantidad` unidades, empezando por el
 * que vence antes. Si los lotes no alcanzan, saca lo que hay (el stock
 * del producto es la fuente de verdad; esto no debería pasar si se
 * respeta la invariante).
 */
export function planDeConsumo(
  lotes: LoteFEFO[],
  cantidad: number,
): { loteId: string; cantidad: number }[] {
  const plan: { loteId: string; cantidad: number }[] = [];
  let falta = cantidad;
  for (const lote of [...lotes].sort(ordenFEFO)) {
    if (falta === 0) break;
    const sacar = Math.min(lote.cantidad, falta);
    if (sacar > 0) {
      plan.push({ loteId: lote.id, cantidad: sacar });
      falta -= sacar;
    }
  }
  return plan;
}

/**
 * Al anular, a qué lote vuelve cada unidad. Se deshace en el orden
 * inverso al consumo: primero vuelve lo que salió del lote que vence más
 * tarde. `consumos` en el orden en que se consumieron (FEFO). Lo que no
 * se pueda atribuir a un lote queda en `sinLote`.
 */
export function planDeDevolucion(
  consumos: { id: string; cantidad: number; cantidadDevuelta: number }[],
  cantidad: number,
): { plan: { consumoId: string; cantidad: number }[]; sinLote: number } {
  const plan: { consumoId: string; cantidad: number }[] = [];
  let falta = cantidad;
  for (const consumo of [...consumos].reverse()) {
    if (falta === 0) break;
    const devolver = Math.min(
      consumo.cantidad - consumo.cantidadDevuelta,
      falta,
    );
    if (devolver > 0) {
      plan.push({ consumoId: consumo.id, cantidad: devolver });
      falta -= devolver;
    }
  }
  return { plan, sinLote: falta };
}

/** La fecha que se muestra en el producto: la del lote con unidades que vence antes. */
export function fechaMasProxima(lotes: LoteFEFO[]): string | null {
  const fechas = lotes
    .filter((l) => l.cantidad > 0 && l.fechaVencimiento !== null)
    .map((l) => l.fechaVencimiento!)
    .sort();
  return fechas[0] ?? null;
}

// --- Con base de datos (dentro de la transacción del llamador) ---

/** Los lotes del producto, en orden FEFO (incluye los agotados). */
export async function lotesDelProducto(
  manager: EntityManager,
  productoId: string,
): Promise<Lote[]> {
  const lotes = await manager
    .getRepository(Lote)
    .find({ where: { productoId } });
  return lotes.sort(ordenFEFO);
}

function actualizarFecha(producto: Producto, lotes: Lote[]) {
  if (lotes.length > 0) producto.fechaVencimiento = fechaMasProxima(lotes);
}

/**
 * Entra mercadería (abastecimiento, stock inicial, devolución sin lote).
 * Llamar ANTES de sumar `cantidad` a producto.stock.
 *
 * - Con fecha: va a un lote de esa fecha (se suma al existente si ya hay
 *   uno con la misma fecha: en la góndola no se distinguen). Si el
 *   producto todavía no tenía lotes pero sí stock, ese stock pasa a un
 *   lote "sin fecha", para que los lotes sumen el stock.
 * - Sin fecha: si el producto maneja lotes, va al lote "sin fecha"; si
 *   no, no hay nada que hacer (devuelve null).
 */
export async function agregarAlLote(
  manager: EntityManager,
  producto: Producto,
  cantidad: number,
  fechaVencimiento: string | null,
): Promise<Lote | null> {
  const repo = manager.getRepository(Lote);
  const lotes = await lotesDelProducto(manager, producto.id);
  if (lotes.length === 0 && fechaVencimiento === null) return null;

  if (lotes.length === 0 && producto.stock > 0) {
    lotes.push(
      await repo.save(
        repo.create({
          tenantId: producto.tenantId,
          productoId: producto.id,
          fechaVencimiento: null,
          cantidad: producto.stock,
          cantidadInicial: producto.stock,
        }),
      ),
    );
  }

  let lote = lotes.find((l) => l.fechaVencimiento === fechaVencimiento);
  if (lote) {
    lote.cantidad += cantidad;
    lote.cantidadInicial += cantidad;
    lote = await repo.save(lote);
  } else {
    lote = await repo.save(
      repo.create({
        tenantId: producto.tenantId,
        productoId: producto.id,
        fechaVencimiento,
        cantidad,
        cantidadInicial: cantidad,
      }),
    );
    lotes.push(lote);
  }
  actualizarFecha(producto, lotes);
  return lote;
}

/**
 * Salen unidades (venta, merma): del lote indicado o, si no se indica,
 * del que vence antes. Devuelve de qué lotes salieron (vacío si el
 * producto no maneja lotes). Llamar con el producto bloqueado; restar del
 * stock es cosa del llamador.
 */
export async function sacarDeLotes(
  manager: EntityManager,
  producto: Producto,
  cantidad: number,
  loteId?: string,
): Promise<{ loteId: string; cantidad: number }[]> {
  const lotes = await lotesDelProducto(manager, producto.id);
  if (lotes.length === 0) {
    if (loteId) throw new LoteDeOtroProductoError(loteId);
    return [];
  }

  let plan: { loteId: string; cantidad: number }[];
  if (loteId) {
    const lote = lotes.find((l) => l.id === loteId);
    if (!lote) throw new LoteDeOtroProductoError(loteId);
    if (lote.cantidad < cantidad) {
      throw new StockDelLoteInsuficienteError(lote.cantidad, cantidad);
    }
    plan = [{ loteId, cantidad }];
  } else {
    plan = planDeConsumo(lotes, cantidad);
  }

  const porId = new Map(lotes.map((l) => [l.id, l]));
  for (const paso of plan) porId.get(paso.loteId)!.cantidad -= paso.cantidad;
  await manager
    .getRepository(Lote)
    .save(plan.map((paso) => porId.get(paso.loteId)!));
  actualizarFecha(producto, lotes);
  return plan;
}

/**
 * Anulación: devuelve `cantidad` unidades de una línea de venta a los
 * lotes de los que salieron. Lo que no se pueda atribuir (la venta es de
 * antes de que el producto tuviera lotes) va al lote "sin fecha". Llamar
 * ANTES de sumar al stock.
 */
export async function devolverALotes(
  manager: EntityManager,
  producto: Producto,
  ventaItemId: string,
  cantidad: number,
): Promise<void> {
  const consumoRepo = manager.getRepository(VentaItemLote);
  const consumos = await consumoRepo.find({
    where: { ventaItemId },
    relations: { lote: true },
  });
  // En el orden en que se consumieron: FEFO de sus lotes.
  consumos.sort((a, b) => ordenFEFO(a.lote, b.lote));

  const { plan, sinLote } = planDeDevolucion(consumos, cantidad);
  const porId = new Map(consumos.map((c) => [c.id, c]));
  for (const paso of plan) {
    const consumo = porId.get(paso.consumoId)!;
    consumo.cantidadDevuelta += paso.cantidad;
    consumo.lote.cantidad += paso.cantidad;
  }
  const tocados = plan.map((paso) => porId.get(paso.consumoId)!);
  await manager.getRepository(Lote).save(tocados.map((c) => c.lote));
  await consumoRepo.save(tocados);

  if (sinLote > 0) {
    // El stock todavía no se sumó: agregarAlLote ve el stock de antes.
    await agregarAlLote(manager, producto, sinLote, null);
  }
  actualizarFecha(producto, await lotesDelProducto(manager, producto.id));
}

export interface FilaDeLote {
  id?: string;
  fechaVencimiento: string | null;
  cantidad: number;
}

/**
 * Corrección del admin después de revisar la góndola: cuántas unidades
 * hay de cada fecha. El total no cambia (tiene que dar el stock): si
 * falta o sobra mercadería, eso es una pérdida o un abastecimiento, que
 * mueven plata y se registran aparte.
 *
 * Las filas con id actualizan ese lote; las sin id crean uno nuevo; los
 * lotes que no vienen quedan en 0. Sirve también para empezar a manejar
 * lotes en un producto que no tenía.
 */
export async function corregirLotes(
  manager: EntityManager,
  producto: Producto,
  filas: FilaDeLote[],
): Promise<void> {
  const total = filas.reduce((acc, f) => acc + f.cantidad, 0);
  if (total !== producto.stock) {
    throw new LotesNoSumanElStockError(total, producto.stock);
  }

  const repo = manager.getRepository(Lote);
  const lotes = await lotesDelProducto(manager, producto.id);
  const porId = new Map(lotes.map((l) => [l.id, l]));
  const vistos = new Set<string>();
  const nuevos: Lote[] = [];

  for (const fila of filas) {
    if (fila.id) {
      const lote = porId.get(fila.id);
      if (!lote || vistos.has(fila.id)) {
        throw new LoteDeOtroProductoError(fila.id);
      }
      vistos.add(fila.id);
      lote.fechaVencimiento = fila.fechaVencimiento;
      lote.cantidad = fila.cantidad;
      // Una corrección puede dejar más de lo que "entró" (estaba mal
      // repartido): que "quedan X de Y" no quede con X > Y.
      lote.cantidadInicial = Math.max(lote.cantidadInicial, fila.cantidad);
    } else if (fila.cantidad > 0) {
      nuevos.push(
        repo.create({
          tenantId: producto.tenantId,
          productoId: producto.id,
          fechaVencimiento: fila.fechaVencimiento,
          cantidad: fila.cantidad,
          cantidadInicial: fila.cantidad,
        }),
      );
    }
  }
  for (const lote of lotes) if (!vistos.has(lote.id)) lote.cantidad = 0;

  await repo.save([...lotes, ...nuevos]);
  producto.fechaVencimiento = fechaMasProxima([...lotes, ...nuevos]);
}
