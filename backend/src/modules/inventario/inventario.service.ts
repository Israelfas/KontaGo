import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { RegistrarAbastecimientoDto } from './dto/registrar-abastecimiento.dto';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';
import { CorregirLotesDto } from './dto/corregir-lotes.dto';
import {
  MovimientoDelHistorialDto,
  ResumenInventarioPeriodoDto,
} from './dto/historial-inventario.dto';
import type { RangoFechas } from '../ventas/rango-fechas';
import { MotivoMerma } from '../../common/enums/motivo-merma.enum';
import { ResumenMovimientosDelDiaDto } from './dto/resumen-movimientos-del-dia.dto';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import {
  ProductoNoEncontradoError,
  StockInsuficienteParaMermaError,
} from './inventario.errors';
import {
  agregarAlLote,
  corregirLotes,
  lotesDelProducto,
  sacarDeLotes,
} from './lotes';

@Injectable()
export class InventarioService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Registra una entrada de mercadería: suma stock y recalcula el costo
   * unitario del producto como costo promedio ponderado (sección 3.2 del
   * spec):
   *
   *   nuevoCosto = (stockActual × costoActual + cantidadNueva × costoCompra)
   *                ────────────────────────────────────────────────────────
   *                              stockActual + cantidadNueva
   *
   * Todo dentro de una transacción con bloqueo pesimista sobre el
   * producto, por la misma razón que el checkout (sección 3.4): si dos
   * abastecimientos del mismo producto llegan casi al mismo tiempo (poco
   * común pero posible con dos personas cargando mercadería), no deben
   * pisarse el cálculo del costo promedio.
   */
  async registrarAbastecimiento(
    tenantId: string,
    usuarioId: string,
    dto: RegistrarAbastecimientoDto,
  ): Promise<MovimientoInventario> {
    return this.dataSource.transaction(async (manager) => {
      const productoRepo = manager.getRepository(Producto);

      const producto = await productoRepo.findOne({
        where: { id: dto.productoId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!producto) {
        throw new ProductoNoEncontradoError(dto.productoId);
      }

      // Antes de sumar al stock (ver agregarAlLote).
      const lote = await agregarAlLote(
        manager,
        producto,
        dto.cantidad,
        dto.fechaVencimiento ?? null,
      );

      const costoTotalActual = producto.stock * producto.costoUnitarioCentavos;
      const costoTotalNuevo = dto.cantidad * dto.costoUnitarioCentavos;
      const stockResultante = producto.stock + dto.cantidad;

      producto.costoUnitarioCentavos = Math.round(
        (costoTotalActual + costoTotalNuevo) / stockResultante,
      );
      producto.stock = stockResultante;
      await productoRepo.save(producto);

      const movimientoRepo = manager.getRepository(MovimientoInventario);
      const movimiento = movimientoRepo.create({
        tenantId,
        productoId: producto.id,
        usuarioId,
        tipo: TipoMovimientoInventario.ABASTECIMIENTO,
        cantidad: dto.cantidad,
        // Se guarda el costo de ESTA compra (no el promedio resultante),
        // para que el historial refleje a qué precio se compró cada vez.
        costoUnitarioCentavos: dto.costoUnitarioCentavos,
        proveedor: dto.proveedor ?? null,
        motivo: null,
        loteId: lote?.id ?? null,
      });

      return movimientoRepo.save(movimiento);
    });
  }

  /**
   * Registra una pérdida (vencido, dañado, robado): descuenta stock sin
   * generar ingreso, valorizada a costo (no a precio de venta) — es
   * dinero perdido, no una venta que no se cobró.
   */
  async registrarMerma(
    tenantId: string,
    usuarioId: string,
    dto: RegistrarMermaDto,
  ): Promise<MovimientoInventario> {
    return this.dataSource.transaction(async (manager) => {
      const productoRepo = manager.getRepository(Producto);

      const producto = await productoRepo.findOne({
        where: { id: dto.productoId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!producto) {
        throw new ProductoNoEncontradoError(dto.productoId);
      }

      if (producto.stock < dto.cantidad) {
        throw new StockInsuficienteParaMermaError(
          producto.id,
          producto.stock,
          dto.cantidad,
        );
      }

      const deLotes = await sacarDeLotes(
        manager,
        producto,
        dto.cantidad,
        dto.loteId,
      );
      producto.stock -= dto.cantidad;
      await productoRepo.save(producto);

      const movimientoRepo = manager.getRepository(MovimientoInventario);
      const movimiento = movimientoRepo.create({
        tenantId,
        productoId: producto.id,
        usuarioId,
        tipo: TipoMovimientoInventario.MERMA,
        cantidad: dto.cantidad,
        // Costo del producto AL MOMENTO de la pérdida — así se valoriza
        // cuánto dinero representa, aunque el costo cambie después.
        costoUnitarioCentavos: producto.costoUnitarioCentavos,
        proveedor: null,
        motivo: dto.motivo,
        loteId: deLotes.length === 1 ? deLotes[0].loteId : null,
      });

      return movimientoRepo.save(movimiento);
    });
  }

  /**
   * Corrección de lotes del admin (ver corregirLotes en lotes.ts): cuántas
   * unidades hay de cada fecha. No cambia el stock ni el costo, así que no
   * genera movimiento. Devuelve el producto con sus lotes.
   */
  async corregirLotes(
    tenantId: string,
    productoId: string,
    dto: CorregirLotesDto,
  ): Promise<Producto> {
    return this.dataSource.transaction(async (manager) => {
      const productoRepo = manager.getRepository(Producto);
      const producto = await productoRepo.findOne({
        where: { id: productoId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new ProductoNoEncontradoError(productoId);
      }

      await corregirLotes(
        manager,
        producto,
        dto.lotes.map((fila) => ({
          id: fila.id,
          fechaVencimiento: fila.fechaVencimiento ?? null,
          cantidad: fila.cantidad,
        })),
      );
      await productoRepo.save(producto);
      producto.lotes = (await lotesDelProducto(manager, producto.id)).filter(
        (lote) => lote.cantidad > 0,
      );
      return producto;
    });
  }

  /**
   * Abastecimientos y mermas de un período, del más reciente al más viejo,
   * paginados. Filtros opcionales por tipo y por producto.
   */
  async listarMovimientos(
    tenantId: string,
    rango: RangoFechas,
    filtros: {
      tipo?: TipoMovimientoInventario;
      productoId?: string;
      limite?: number;
      desplazamiento?: number;
    },
  ): Promise<{ movimientos: MovimientoDelHistorialDto[]; total: number }> {
    const consulta = this.dataSource
      .getRepository(MovimientoInventario)
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.producto', 'producto')
      .leftJoinAndSelect('movimiento.usuario', 'usuario')
      .leftJoinAndSelect('movimiento.lote', 'lote')
      .where('movimiento.tenantId = :tenantId', { tenantId })
      .andWhere('movimiento.createdAt >= :inicio', { inicio: rango.inicio })
      .andWhere('movimiento.createdAt < :fin', { fin: rango.finExclusivo });
    if (filtros.tipo) {
      consulta.andWhere('movimiento.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (filtros.productoId) {
      consulta.andWhere('movimiento.productoId = :productoId', {
        productoId: filtros.productoId,
      });
    }
    const [movimientos, total] = await consulta
      .orderBy('movimiento.createdAt', 'DESC')
      .skip(filtros.desplazamiento ?? 0)
      .take(filtros.limite ?? 50)
      .getManyAndCount();

    return {
      total,
      movimientos: movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        createdAt: m.createdAt,
        producto: { id: m.producto.id, nombre: m.producto.nombre },
        cantidad: m.cantidad,
        costoUnitarioCentavos: m.costoUnitarioCentavos,
        totalCentavos: m.costoUnitarioCentavos * m.cantidad,
        proveedor: m.proveedor,
        motivo: m.motivo,
        vencimientoLote: m.lote?.fechaVencimiento ?? null,
        registradoPor: m.usuario.nombre,
      })),
    };
  }

  /**
   * Lo que se gastó en mercadería y lo que se perdió en el período, con
   * los desgloses que responden las preguntas del dueño: ¿por qué pierdo?,
   * ¿a quién le compro más?, ¿qué producto se me echa a perder?
   */
  async resumenDelPeriodo(
    tenantId: string,
    rango: RangoFechas,
  ): Promise<ResumenInventarioPeriodoDto> {
    const movimientos = await this.dataSource
      .getRepository(MovimientoInventario)
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.producto', 'producto')
      .where('movimiento.tenantId = :tenantId', { tenantId })
      .andWhere('movimiento.createdAt >= :inicio', { inicio: rango.inicio })
      .andWhere('movimiento.createdAt < :fin', { fin: rango.finExclusivo })
      // En orden: al juntar "Pasteurizadora Quito" con "pasteurizadora
      // quito ", se muestra como se escribió la primera vez. Sin orden,
      // Postgres los devuelve como le toca y el nombre cambiaba.
      .orderBy('movimiento.createdAt', 'ASC')
      .addOrderBy('movimiento.id', 'ASC')
      .getMany();

    const total = (m: MovimientoInventario) =>
      m.costoUnitarioCentavos * m.cantidad;
    const abastecimientos = movimientos.filter(
      (m) => m.tipo === TipoMovimientoInventario.ABASTECIMIENTO,
    );
    const mermas = movimientos.filter(
      (m) => m.tipo === TipoMovimientoInventario.MERMA,
    );

    const porMotivo = new Map<
      MotivoMerma,
      { motivo: MotivoMerma; unidades: number; centavos: number }
    >();
    const porProducto = new Map<
      string,
      { nombre: string; unidades: number; centavos: number }
    >();
    for (const m of mermas) {
      const motivo = m.motivo ?? MotivoMerma.OTRO;
      const deMotivo = porMotivo.get(motivo) ?? {
        motivo,
        unidades: 0,
        centavos: 0,
      };
      deMotivo.unidades += m.cantidad;
      deMotivo.centavos += total(m);
      porMotivo.set(motivo, deMotivo);

      const deProducto = porProducto.get(m.productoId) ?? {
        nombre: m.producto.nombre,
        unidades: 0,
        centavos: 0,
      };
      deProducto.unidades += m.cantidad;
      deProducto.centavos += total(m);
      porProducto.set(m.productoId, deProducto);
    }

    const porProveedor = new Map<
      string,
      { proveedor: string | null; compras: number; centavos: number }
    >();
    for (const m of abastecimientos) {
      // Sin distinguir mayúsculas ni espacios: "Arca" y "arca " son el mismo.
      const clave = m.proveedor?.trim().toLowerCase() ?? '';
      const previo = porProveedor.get(clave) ?? {
        proveedor: m.proveedor?.trim() || null,
        compras: 0,
        centavos: 0,
      };
      previo.compras++;
      previo.centavos += total(m);
      porProveedor.set(clave, previo);
    }

    const mayorPrimero = (a: { centavos: number }, b: { centavos: number }) =>
      b.centavos - a.centavos;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      dias: rango.dias,
      egresoCentavos: abastecimientos.reduce((acc, m) => acc + total(m), 0),
      cantidadAbastecimientos: abastecimientos.length,
      perdidaCentavos: mermas.reduce((acc, m) => acc + total(m), 0),
      cantidadMermas: mermas.length,
      perdidaPorMotivo: [...porMotivo.values()].sort(mayorPrimero),
      porProveedor: [...porProveedor.values()].sort(mayorPrimero).slice(0, 5),
      productosConMasPerdida: [...porProducto.values()]
        .sort(mayorPrimero)
        .slice(0, 5),
    };
  }

  /**
   * Resumen del día: egreso de caja (lo gastado en abastecimiento) y
   * pérdidas (valor a costo de las mermas) — separado del ingreso/ganancia
   * de ventas, que vive en VentasService (sección 3.3 del spec: reportes
   * deben distinguir claramente estos cuatro conceptos).
   */
  async obtenerResumenDelDia(
    tenantId: string,
  ): Promise<ResumenMovimientosDelDiaDto> {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const movimientoRepo = this.dataSource.getRepository(MovimientoInventario);
    const movimientosDeHoy = await movimientoRepo
      .createQueryBuilder('movimiento')
      .where('movimiento.tenantId = :tenantId', { tenantId })
      .andWhere('movimiento.createdAt >= :inicioDelDia', { inicioDelDia })
      .getMany();

    const abastecimientos = movimientosDeHoy.filter(
      (m) => m.tipo === TipoMovimientoInventario.ABASTECIMIENTO,
    );
    const mermas = movimientosDeHoy.filter(
      (m) => m.tipo === TipoMovimientoInventario.MERMA,
    );

    const egresoCentavos = abastecimientos.reduce(
      (acc, m) => acc + m.costoUnitarioCentavos * m.cantidad,
      0,
    );
    const perdidaCentavos = mermas.reduce(
      (acc, m) => acc + m.costoUnitarioCentavos * m.cantidad,
      0,
    );

    return {
      fecha: inicioDelDia.toISOString().slice(0, 10),
      egresoCentavos,
      perdidaCentavos,
      cantidadAbastecimientos: abastecimientos.length,
      cantidadMermas: mermas.length,
    };
  }
}
