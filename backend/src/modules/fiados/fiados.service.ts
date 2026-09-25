import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { AbonoFiado, MetodoDeAbono } from './entities/abono-fiado.entity';
import { Venta } from '../ventas/entities/venta.entity';
import { MetodoPago } from '../../common/enums/metodo-pago.enum';
import { registrarMovimiento, turnoAbiertoDe } from '../caja/turnos';
import { TipoMovimientoCaja } from '../caja/entities/movimiento-caja.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AbonoDto,
  ActualizarClienteDto,
  ClienteConSaldoDto,
  CrearClienteDto,
  DetalleClienteDto,
  MovimientoDeFiadoDto,
} from './dto/fiados.dto';
import {
  AbonoMayorQueLaDeudaError,
  AbonoSinCajaError,
  ClienteConDeudaError,
  ClienteNoEncontradoError,
} from './fiados.errors';

interface FilaDeSaldo {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  saldo: number;
  ultimo: Date | null;
}

/**
 * Lo que debe cada cliente: sus ventas al fiado (menos lo anulado) menos
 * sus abonos. Se calcula siempre de los movimientos, no se guarda.
 */
const SALDOS = `
  SELECT c.id, c.nombre, c.telefono, c.activo,
         (coalesce(v.fiado, 0) - coalesce(a.abonado, 0))::int AS saldo,
         greatest(v.ultima, a.ultima) AS ultimo
    FROM clientes c
    LEFT JOIN (
      SELECT cliente_id, sum(total_centavos - total_anulado_centavos) AS fiado,
             max(created_at) AS ultima
        FROM ventas
       WHERE tenant_id = $1 AND metodo_pago = 'fiado'
       GROUP BY cliente_id
    ) v ON v.cliente_id = c.id
    LEFT JOIN (
      SELECT cliente_id, sum(monto_centavos) AS abonado, max(created_at) AS ultima
        FROM abonos_fiado
       WHERE tenant_id = $1
       GROUP BY cliente_id
    ) a ON a.cliente_id = c.id
   WHERE c.tenant_id = $1`;

/** Para vender al fiado: el cliente tiene que existir y no estar archivado. */
export async function clienteParaFiar(
  manager: EntityManager,
  tenantId: string,
  clienteId: string,
): Promise<Cliente> {
  const cliente = await manager.getRepository(Cliente).findOne({
    where: { id: clienteId, tenantId, activo: true },
  });
  if (!cliente) throw new ClienteNoEncontradoError();
  return cliente;
}

const aDto = (fila: FilaDeSaldo): ClienteConSaldoDto => ({
  id: fila.id,
  nombre: fila.nombre,
  telefono: fila.telefono,
  activo: fila.activo,
  saldoCentavos: fila.saldo,
  ultimoMovimiento: fila.ultimo,
});

@Injectable()
export class FiadosService {
  constructor(private readonly dataSource: DataSource) {}

  /** Los clientes de la tienda, primero los que más deben. */
  async listar(
    tenantId: string,
    incluirArchivados = false,
  ): Promise<ClienteConSaldoDto[]> {
    const filas = await this.dataSource.query<FilaDeSaldo[]>(
      `${SALDOS} ${incluirArchivados ? '' : 'AND c.activo'}
       ORDER BY saldo DESC, lower(c.nombre)`,
      [tenantId],
    );
    return filas.map(aDto);
  }

  crear(tenantId: string, dto: CrearClienteDto): Promise<Cliente> {
    const repo = this.dataSource.getRepository(Cliente);
    return repo.save(
      repo.create({
        tenantId,
        nombre: dto.nombre.trim(),
        telefono: dto.telefono?.trim() || null,
      }),
    );
  }

  async actualizar(
    tenantId: string,
    id: string,
    dto: ActualizarClienteDto,
  ): Promise<ClienteConSaldoDto> {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await manager.getRepository(Cliente).findOne({
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cliente) throw new ClienteNoEncontradoError();
      if (dto.nombre !== undefined) cliente.nombre = dto.nombre.trim();
      if (dto.telefono !== undefined) {
        cliente.telefono = dto.telefono.trim() || null;
      }
      if (dto.activo === false && cliente.activo) {
        const saldo = await this.saldoDe(manager, tenantId, id);
        if (saldo > 0) throw new ClienteConDeudaError(saldo);
      }
      if (dto.activo !== undefined) cliente.activo = dto.activo;
      await manager.getRepository(Cliente).save(cliente);
      return this.conSaldo(manager, tenantId, id);
    });
  }

  /** El cliente con su saldo y su historial (lo más nuevo primero). */
  async detalle(tenantId: string, id: string): Promise<DetalleClienteDto> {
    const cliente = await this.conSaldo(this.dataSource.manager, tenantId, id);
    const [ventas, abonos] = await Promise.all([
      this.dataSource.getRepository(Venta).find({
        where: { tenantId, clienteId: id, metodoPago: MetodoPago.FIADO },
        relations: { items: { producto: true } },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
      this.dataSource.getRepository(AbonoFiado).find({
        where: { tenantId, clienteId: id },
        relations: { usuario: true },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    ]);
    const movimientos: MovimientoDeFiadoDto[] = [
      ...ventas.map((venta): MovimientoDeFiadoDto => ({
        tipo: 'venta',
        id: venta.id,
        fecha: venta.createdAt,
        numero: venta.numero,
        totalCentavos: venta.totalCentavos,
        anuladoCentavos: venta.totalAnuladoCentavos,
        items: venta.items.map((item) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          unidad: item.producto.unidad,
        })),
      })),
      ...abonos.map((abono): MovimientoDeFiadoDto => ({
        tipo: 'abono',
        id: abono.id,
        fecha: abono.createdAt,
        montoCentavos: abono.montoCentavos,
        metodoPago: abono.metodoPago,
        registradoPor: abono.usuario.nombre,
        nota: abono.nota,
      })),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return { ...cliente, movimientos };
  }

  /**
   * El cliente paga (todo o una parte). En efectivo, el dinero entra a la
   * caja abierta de quien lo recibe, como un ingreso: así el arqueo cuadra.
   */
  async abonar(
    user: AuthenticatedUser,
    clienteId: string,
    dto: AbonoDto,
  ): Promise<ClienteConSaldoDto> {
    return this.dataSource.transaction(async (manager) => {
      // Un abono a la vez por cliente: dos al mismo tiempo no pagan de más.
      const cliente = await manager.getRepository(Cliente).findOne({
        where: { id: clienteId, tenantId: user.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cliente) throw new ClienteNoEncontradoError();

      const saldo = await this.saldoDe(manager, user.tenantId, clienteId);
      if (dto.montoCentavos > saldo) {
        throw new AbonoMayorQueLaDeudaError(dto.montoCentavos, saldo);
      }

      let turnoId: string | null = null;
      if (dto.metodoPago === MetodoDeAbono.EFECTIVO) {
        const turno = await turnoAbiertoDe(
          manager,
          user.tenantId,
          user.usuarioId,
          'compartido',
        );
        if (!turno) throw new AbonoSinCajaError();
        await registrarMovimiento(
          manager,
          turno,
          user.usuarioId,
          TipoMovimientoCaja.INGRESO,
          dto.montoCentavos,
          `Abono de fiado: ${cliente.nombre}`.slice(0, 200),
        );
        turnoId = turno.id;
      }

      const repo = manager.getRepository(AbonoFiado);
      await repo.save(
        repo.create({
          tenantId: user.tenantId,
          clienteId,
          usuarioId: user.usuarioId,
          montoCentavos: dto.montoCentavos,
          metodoPago: dto.metodoPago,
          turnoId,
          nota: dto.nota?.trim() || null,
        }),
      );
      return this.conSaldo(manager, user.tenantId, clienteId);
    });
  }

  private async conSaldo(
    manager: EntityManager,
    tenantId: string,
    id: string,
  ): Promise<ClienteConSaldoDto> {
    const [fila] = await manager.query<FilaDeSaldo[]>(
      `${SALDOS} AND c.id = $2`,
      [tenantId, id],
    );
    if (!fila) throw new ClienteNoEncontradoError();
    return aDto(fila);
  }

  private async saldoDe(
    manager: EntityManager,
    tenantId: string,
    id: string,
  ): Promise<number> {
    return (await this.conSaldo(manager, tenantId, id)).saldoCentavos;
  }
}
