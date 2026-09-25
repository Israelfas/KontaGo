import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TurnoCaja } from './entities/turno-caja.entity';
import { MovimientoCaja } from './entities/movimiento-caja.entity';
import {
  AbrirCajaDto,
  CerrarCajaDto,
  MovimientoCajaDto,
  TurnoDto,
} from './dto/caja.dto';
import {
  CajaCerradaError,
  CajaYaAbiertaError,
  TurnoNoEncontradoError,
  TurnoYaCerradoError,
} from './caja.errors';
import { cuentasDelTurno, registrarMovimiento, turnoAbiertoDe } from './turnos';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { RangoFechas } from '../ventas/rango-fechas';

// 23505 = unique_violation (acá: ya hay un turno abierto de ese usuario).
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

@Injectable()
export class CajaService {
  constructor(private readonly dataSource: DataSource) {}

  /** El turno abierto de quien pregunta (null si no tiene). */
  async actual(user: AuthenticatedUser): Promise<TurnoDto | null> {
    const turno = await turnoAbiertoDe(
      this.dataSource.manager,
      user.tenantId,
      user.usuarioId,
    );
    return turno ? this.aDto(this.dataSource.manager, turno, user) : null;
  }

  async abrir(user: AuthenticatedUser, dto: AbrirCajaDto): Promise<TurnoDto> {
    const repo = this.dataSource.getRepository(TurnoCaja);
    let turno: TurnoCaja;
    try {
      turno = await repo.save(
        repo.create({
          tenantId: user.tenantId,
          usuarioId: user.usuarioId,
          fondoInicialCentavos: dto.fondoInicialCentavos,
        }),
      );
    } catch (error) {
      // El índice único parcial es el que manda (dos "abrir" a la vez).
      if (esViolacionDeUnicidad(error)) throw new CajaYaAbiertaError();
      throw error;
    }
    return this.aDto(
      this.dataSource.manager,
      await repo.findOneByOrFail({ id: turno.id }),
      user,
    );
  }

  /** Retiro o ingreso de efectivo en el turno abierto de quien lo registra. */
  async registrarMovimiento(
    user: AuthenticatedUser,
    dto: MovimientoCajaDto,
  ): Promise<TurnoDto> {
    return this.dataSource.transaction(async (manager) => {
      const turno = await turnoAbiertoDe(
        manager,
        user.tenantId,
        user.usuarioId,
        'compartido',
      );
      if (!turno) throw new CajaCerradaError();
      await registrarMovimiento(
        manager,
        turno,
        user.usuarioId,
        dto.tipo,
        dto.montoCentavos,
        dto.motivo.trim(),
      );
      return this.aDto(manager, turno, user);
    });
  }

  /** Cierra el turno propio con lo que se contó. */
  async cerrarPropio(
    user: AuthenticatedUser,
    dto: CerrarCajaDto,
  ): Promise<TurnoDto> {
    return this.dataSource.transaction(async (manager) => {
      const turno = await turnoAbiertoDe(
        manager,
        user.tenantId,
        user.usuarioId,
        'exclusivo',
      );
      if (!turno) throw new CajaCerradaError();
      return this.cerrar(manager, turno, user, dto);
    });
  }

  /**
   * El admin cierra el turno de otro (el cajero se fue sin cerrar): cuenta
   * él lo que hay en el cajón.
   */
  async cerrarDeOtro(
    user: AuthenticatedUser,
    turnoId: string,
    dto: CerrarCajaDto,
  ): Promise<TurnoDto> {
    return this.dataSource.transaction(async (manager) => {
      const turno = await manager.getRepository(TurnoCaja).findOne({
        where: { id: turnoId, tenantId: user.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!turno) throw new TurnoNoEncontradoError();
      if (turno.cerradoEn) throw new TurnoYaCerradoError();
      return this.cerrar(manager, turno, user, dto);
    });
  }

  /**
   * Turnos del período (abiertos en esas fechas) y, además, los que siguen
   * abiertos aunque sean de antes. Solo admin: ve el esperado de todos.
   */
  async listar(
    user: AuthenticatedUser,
    rango: RangoFechas,
  ): Promise<TurnoDto[]> {
    const turnos = await this.dataSource
      .getRepository(TurnoCaja)
      .createQueryBuilder('turno')
      .where('turno.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere(
        '((turno.abiertoEn >= :inicio AND turno.abiertoEn < :fin) OR turno.cerradoEn IS NULL)',
        { inicio: rango.inicio, fin: rango.finExclusivo },
      )
      .orderBy('turno.abiertoEn', 'DESC')
      .getMany();
    return Promise.all(
      turnos.map((turno) => this.aDto(this.dataSource.manager, turno, user)),
    );
  }

  private async cerrar(
    manager: EntityManager,
    turno: TurnoCaja,
    user: AuthenticatedUser,
    dto: CerrarCajaDto,
  ): Promise<TurnoDto> {
    // Con el turno bloqueado: ninguna venta ni movimiento nuevo entra
    // mientras se calcula lo esperado.
    const cuentas = await cuentasDelTurno(manager, turno);
    turno.cerradoEn = new Date();
    turno.cerradoPorId = user.usuarioId;
    turno.efectivoEsperadoCentavos = cuentas.efectivoEsperadoCentavos;
    turno.efectivoContadoCentavos = dto.efectivoContadoCentavos;
    turno.nota = dto.nota?.trim() || null;
    await manager.getRepository(TurnoCaja).save(turno);
    return this.aDto(manager, turno, user);
  }

  private async aDto(
    manager: EntityManager,
    turno: TurnoCaja,
    user: AuthenticatedUser,
  ): Promise<TurnoDto> {
    const [cuentas, movimientos, nombres] = await Promise.all([
      cuentasDelTurno(manager, turno),
      manager.getRepository(MovimientoCaja).find({
        where: { turnoId: turno.id },
        relations: { usuario: true },
        order: { createdAt: 'ASC' },
      }),
      this.nombres(manager, [turno.usuarioId, turno.cerradoPorId]),
    ]);
    const cerrado = turno.cerradoEn !== null;
    // Conteo a ciegas: con el turno abierto, el cajero no ve cuánto
    // efectivo debería haber. El admin sí, siempre.
    const veEsperado = cerrado || user.rol === Rol.ADMIN;
    // Cerrado: lo congelado al cerrar, no lo que dé hoy la cuenta (una
    // anulación posterior se devuelve desde otra caja, ver ventas).
    const esperado = cerrado
      ? turno.efectivoEsperadoCentavos!
      : cuentas.efectivoEsperadoCentavos;

    return {
      id: turno.id,
      estado: cerrado ? 'cerrado' : 'abierto',
      cajero: nombres.get(turno.usuarioId) ?? '',
      usuarioId: turno.usuarioId,
      abiertoEn: turno.abiertoEn,
      cerradoEn: turno.cerradoEn,
      cerradoPor: turno.cerradoPorId
        ? (nombres.get(turno.cerradoPorId) ?? null)
        : null,
      fondoInicialCentavos: turno.fondoInicialCentavos,
      cantidadVentas: cuentas.cantidadVentas,
      ventasTransferenciaCentavos: cuentas.ventasTransferenciaCentavos,
      ventasFiadoCentavos: cuentas.ventasFiadoCentavos,
      ingresosCentavos: cuentas.ingresosCentavos,
      retirosCentavos: cuentas.retirosCentavos,
      ...(veEsperado
        ? {
            // Cerrado: se deduce de lo congelado, así el desglose siempre
            // suma lo esperado (aunque después se anule una venta suya).
            ventasEfectivoCentavos: cerrado
              ? esperado -
                turno.fondoInicialCentavos -
                cuentas.ingresosCentavos +
                cuentas.retirosCentavos
              : cuentas.ventasEfectivoCentavos,
            efectivoEsperadoCentavos: esperado,
          }
        : {}),
      ...(cerrado
        ? {
            efectivoContadoCentavos: turno.efectivoContadoCentavos!,
            diferenciaCentavos: turno.efectivoContadoCentavos! - esperado,
          }
        : {}),
      nota: turno.nota,
      movimientos: movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        montoCentavos: m.montoCentavos,
        motivo: m.motivo,
        usuario: m.usuario.nombre,
        createdAt: m.createdAt,
      })),
    };
  }

  private async nombres(
    manager: EntityManager,
    ids: (string | null)[],
  ): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    const filas = await manager.query<{ id: string; nombre: string }[]>(
      `SELECT id, nombre FROM usuarios WHERE id = ANY($1)`,
      [unicos],
    );
    return new Map(filas.map((f) => [f.id, f.nombre]));
  }
}
