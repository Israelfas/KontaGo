import { EntityManager, IsNull } from 'typeorm';
import { TurnoCaja } from './entities/turno-caja.entity';
import {
  MovimientoCaja,
  TipoMovimientoCaja,
} from './entities/movimiento-caja.entity';
import { MetodoPago } from '../../common/enums/metodo-pago.enum';

/**
 * Lo que necesitan otros módulos (ventas) sobre la caja, para usar DENTRO
 * de su propia transacción. Igual que inventario/lotes.ts.
 *
 * Bloqueos: una venta toma el turno con FOR SHARE (muchas ventas a la vez
 * no se frenan entre sí) y el cierre con FOR UPDATE. Así el cierre espera
 * a las ventas que ya empezaron, y ninguna venta entra en un turno a
 * mitad de su arqueo.
 */

/** El turno abierto del usuario, o null. */
export function turnoAbiertoDe(
  manager: EntityManager,
  tenantId: string,
  usuarioId: string,
  bloqueo?: 'compartido' | 'exclusivo',
): Promise<TurnoCaja | null> {
  return manager.getRepository(TurnoCaja).findOne({
    where: { tenantId, usuarioId, cerradoEn: IsNull() },
    ...(bloqueo
      ? {
          lock: {
            mode:
              bloqueo === 'compartido'
                ? 'pessimistic_read'
                : 'pessimistic_write',
          },
        }
      : {}),
  });
}

/** Un turno por id, bloqueado para compartir (lo usa la anulación). */
export function turnoCompartido(
  manager: EntityManager,
  turnoId: string,
): Promise<TurnoCaja | null> {
  return manager.getRepository(TurnoCaja).findOne({
    where: { id: turnoId },
    lock: { mode: 'pessimistic_read' },
  });
}

export async function registrarMovimiento(
  manager: EntityManager,
  turno: TurnoCaja,
  usuarioId: string,
  tipo: TipoMovimientoCaja,
  montoCentavos: number,
  motivo: string,
): Promise<MovimientoCaja> {
  const repo = manager.getRepository(MovimientoCaja);
  return repo.save(
    repo.create({
      tenantId: turno.tenantId,
      turnoId: turno.id,
      usuarioId,
      tipo,
      montoCentavos,
      motivo,
    }),
  );
}

export interface CuentasDelTurno {
  fondoInicialCentavos: number;
  // Con algo cobrado (una venta anulada entera no cuenta).
  cantidadVentas: number;
  // Ya descontado lo anulado.
  ventasEfectivoCentavos: number;
  ventasTransferenciaCentavos: number;
  // Al fiado: vendido, pero no entra al cajón.
  ventasFiadoCentavos: number;
  ingresosCentavos: number;
  retirosCentavos: number;
  efectivoEsperadoCentavos: number;
}

/**
 * Cuánto efectivo tiene que haber en el cajón:
 *   fondo inicial + ventas en efectivo (menos lo anulado) + ingresos − retiros
 * El vuelto no suma ni resta: de lo que dio el cliente, el vuelto sale del
 * mismo cajón, así que lo que queda es el total de la venta.
 */
export async function cuentasDelTurno(
  manager: EntityManager,
  turno: TurnoCaja,
): Promise<CuentasDelTurno> {
  return (await cuentasDeTurnos(manager, [turno])).get(turno.id)!;
}

/**
 * Lo mismo para muchos turnos (el listado, el Excel): dos consultas en
 * total, no dos por turno. Con miles de turnos en el período, una consulta
 * por turno ocupaba todas las conexiones a la base, que son de todas las
 * tiendas.
 */
export async function cuentasDeTurnos(
  manager: EntityManager,
  turnos: TurnoCaja[],
): Promise<Map<string, CuentasDelTurno>> {
  const ids = turnos.map((turno) => turno.id);
  if (ids.length === 0) return new Map();
  const ventas = await manager.query<
    {
      turno_id: string;
      metodo_pago: MetodoPago;
      cantidad: number;
      neto: string;
    }[]
  >(
    `SELECT turno_id, metodo_pago,
            count(*) FILTER (WHERE total_centavos > total_anulado_centavos)::int AS cantidad,
            coalesce(sum(total_centavos - total_anulado_centavos), 0)::bigint AS neto
       FROM ventas WHERE turno_id = ANY($1) GROUP BY turno_id, metodo_pago`,
    [ids],
  );
  const movimientos = await manager.query<
    { turno_id: string; tipo: TipoMovimientoCaja; monto: string }[]
  >(
    `SELECT turno_id, tipo, coalesce(sum(monto_centavos), 0)::bigint AS monto
       FROM movimientos_caja WHERE turno_id = ANY($1) GROUP BY turno_id, tipo`,
    [ids],
  );

  const ventasPorTurno = agruparPorTurno(ventas);
  const movimientosPorTurno = agruparPorTurno(movimientos);
  return new Map(
    turnos.map((turno) => [
      turno.id,
      armarCuentas(
        turno,
        ventasPorTurno.get(turno.id) ?? [],
        movimientosPorTurno.get(turno.id) ?? [],
      ),
    ]),
  );
}

function agruparPorTurno<T extends { turno_id: string }>(
  filas: T[],
): Map<string, T[]> {
  const porTurno = new Map<string, T[]>();
  for (const fila of filas) {
    const lista = porTurno.get(fila.turno_id) ?? [];
    lista.push(fila);
    porTurno.set(fila.turno_id, lista);
  }
  return porTurno;
}

function armarCuentas(
  turno: TurnoCaja,
  ventas: { metodo_pago: MetodoPago; cantidad: number; neto: string }[],
  movimientos: { tipo: TipoMovimientoCaja; monto: string }[],
): CuentasDelTurno {
  // Sumas en bigint: con ::int, un turno con muchos ingresos pasaba de
  // 2.147.483.647 centavos y ya no se podía cerrar ni listar. Postgres
  // devuelve bigint como texto; en centavos cabe de sobra en un number.
  const netoDe = (metodo: MetodoPago) =>
    Number(ventas.find((v) => v.metodo_pago === metodo)?.neto ?? 0);
  const montoDe = (tipo: TipoMovimientoCaja) =>
    Number(movimientos.find((m) => m.tipo === tipo)?.monto ?? 0);

  const ventasEfectivoCentavos = netoDe(MetodoPago.EFECTIVO);
  const ingresosCentavos = montoDe(TipoMovimientoCaja.INGRESO);
  const retirosCentavos = montoDe(TipoMovimientoCaja.RETIRO);
  return {
    fondoInicialCentavos: turno.fondoInicialCentavos,
    cantidadVentas: ventas.reduce((acc, v) => acc + v.cantidad, 0),
    ventasEfectivoCentavos,
    ventasTransferenciaCentavos: netoDe(MetodoPago.TRANSFERENCIA),
    ventasFiadoCentavos: netoDe(MetodoPago.FIADO),
    ingresosCentavos,
    retirosCentavos,
    efectivoEsperadoCentavos:
      turno.fondoInicialCentavos +
      ventasEfectivoCentavos +
      ingresosCentavos -
      retirosCentavos,
  };
}
