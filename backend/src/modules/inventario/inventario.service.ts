import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { RegistrarAbastecimientoDto } from './dto/registrar-abastecimiento.dto';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';
import { CorregirLotesDto } from './dto/corregir-lotes.dto';
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
