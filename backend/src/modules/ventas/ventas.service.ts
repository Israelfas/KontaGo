import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Venta } from './entities/venta.entity';
import { VentaItem } from './entities/venta-item.entity';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { ResumenDelDiaDto } from './dto/resumen-del-dia.dto';
import {
  MontoRecibidoInsuficienteError,
  ProductoNoEncontradoError,
  StockInsuficienteError,
} from './ventas.errors';

@Injectable()
export class VentasService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Registra una venta completa: valida stock, descuenta inventario y
   * calcula el total/vuelto — todo dentro de UNA transacción con bloqueo
   * pesimista (SELECT ... FOR UPDATE) sobre cada producto involucrado.
   *
   * Por qué esto es necesario (ver sección 3.4 y riesgo #3 del spec):
   * si dos cajeros escanean el mismo producto casi al mismo tiempo (dos
   * cajas, o multi-sucursal), sin este bloqueo ambas transacciones pueden
   * leer el mismo stock "antes" de que la otra lo descuente, y terminar
   * vendiendo más unidades de las que existen. pessimistic_write hace que
   * la segunda transacción espere a que la primera termine (commit o
   * rollback) antes de leer la fila, así el chequeo de stock siempre es
   * sobre el valor real y actualizado.
   */
  async crearVenta(
    tenantId: string,
    usuarioId: string,
    dto: CrearVentaDto,
  ): Promise<Venta> {
    return this.dataSource.transaction(async (manager) => {
      const productoRepo = manager.getRepository(Producto);
      let totalCentavos = 0;
      const items: VentaItem[] = [];

      for (const linea of dto.items) {
        // Bloqueo pesimista: ninguna otra transacción puede leer/escribir
        // esta fila hasta que esta transacción termine.
        const producto = await productoRepo.findOne({
          where: { id: linea.productoId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!producto) {
          throw new ProductoNoEncontradoError(linea.productoId);
        }

        if (producto.stock < linea.cantidad) {
          throw new StockInsuficienteError(
            producto.id,
            producto.stock,
            linea.cantidad,
          );
        }

        producto.stock -= linea.cantidad;
        await productoRepo.save(producto);

        const subtotalCentavos = producto.precioVentaCentavos * linea.cantidad;
        totalCentavos += subtotalCentavos;

        const item = new VentaItem();
        item.productoId = producto.id;
        item.cantidad = linea.cantidad;
        // Congelamos precio y costo del momento de la venta.
        item.precioVentaCentavos = producto.precioVentaCentavos;
        item.costoUnitarioCentavos = producto.costoUnitarioCentavos;
        items.push(item);
      }

      if (dto.montoRecibidoCentavos < totalCentavos) {
        throw new MontoRecibidoInsuficienteError(
          totalCentavos,
          dto.montoRecibidoCentavos,
        );
      }

      const venta = new Venta();
      venta.tenantId = tenantId;
      venta.usuarioId = usuarioId;
      venta.totalCentavos = totalCentavos;
      venta.montoRecibidoCentavos = dto.montoRecibidoCentavos;
      venta.vueltoCentavos = dto.montoRecibidoCentavos - totalCentavos;
      venta.items = items;

      const ventaRepo = manager.getRepository(Venta);
      return ventaRepo.save(venta);
    });
  }

  /**
   * Ganancia real de una venta = suma de (precioVenta - costoUnitario) * cantidad
   * por cada línea. Nunca el ingreso bruto (ver riesgo #2 del spec).
   */
  calcularGananciaCentavos(venta: Venta): number {
    return venta.items.reduce((acc, item) => {
      const margenUnitario =
        item.precioVentaCentavos - item.costoUnitarioCentavos;
      return acc + margenUnitario * item.cantidad;
    }, 0);
  }

  /**
   * Resumen del día actual para el dashboard simple del MVP (sección 3.2
   * del spec: la ganancia del día es parte del MVP, no se pospone a Fase 3).
   *
   * Nota: usa el día calendario del servidor. Si más adelante se necesita
   * que "el día" respete la zona horaria de cada tienda (relevante para
   * negocios en distintos países), esto se ajusta guardando una zona
   * horaria por tenant y filtrando con ella en vez de con medianoche UTC.
   * Para el MVP de un solo país/zona horaria esto no hace falta.
   *
   * Las tendencias históricas (semana/mes) y comparativas SÍ quedan para
   * la Fase 3, porque requieren tablas agregadas para no degradar el
   * rendimiento con el volumen (ver riesgo #4 del spec) — este método hace
   * el cálculo en vivo sobre un solo día, que es liviano.
   */
  async obtenerResumenDelDia(tenantId: string): Promise<ResumenDelDiaDto> {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const ventaRepo = this.dataSource.getRepository(Venta);
    const ventas = await ventaRepo
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.items', 'item')
      .where('venta.tenantId = :tenantId', { tenantId })
      .andWhere('venta.createdAt >= :inicioDelDia', { inicioDelDia })
      .getMany();

    const ingresoBrutoCentavos = ventas.reduce(
      (acc, venta) => acc + venta.totalCentavos,
      0,
    );
    const gananciaCentavos = ventas.reduce(
      (acc, venta) => acc + this.calcularGananciaCentavos(venta),
      0,
    );

    return {
      fecha: inicioDelDia.toISOString().slice(0, 10),
      cantidadVentas: ventas.length,
      ingresoBrutoCentavos,
      gananciaCentavos,
    };
  }
}
