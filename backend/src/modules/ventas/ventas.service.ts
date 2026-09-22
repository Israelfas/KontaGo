import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Venta } from './entities/venta.entity';
import { VentaItem } from './entities/venta-item.entity';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { ResumenDelDiaDto } from './dto/resumen-del-dia.dto';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { VentaDelHistorialDto } from './dto/venta-del-historial.dto';
import {
  AnulacionVenta,
  DetalleAnulacion,
} from './entities/anulacion-venta.entity';
import { fechaLocal } from '../../common/formato-fecha';
import {
  CantidadAAnularInvalidaError,
  LineaDeOtraVentaError,
  MontoRecibidoInsuficienteError,
  ProductoNoEncontradoError,
  StockInsuficienteError,
  VentaDeOtroDiaError,
  VentaNoEncontradaError,
  VentaYaAnuladaError,
} from './ventas.errors';

// totalCentavos ya incluye IVA (precio final al público). Estos dos
// campos son un desglose derivado, no datos nuevos: subtotalCentavos es
// la base imponible (totalCentavos - ivaCentavos). Se calculan una sola
// vez acá para que web/mobile no tengan que sumar venta.items[] a mano
// cada vez que quieran mostrar el desglose en el ticket.
export interface VentaConDesglose extends Venta {
  ivaCentavos: number;
  subtotalCentavos: number;
}

@Injectable()
export class VentasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * precioVentaCentavos ya incluye IVA (así se muestran los precios al
   * público en Ecuador) — este método EXTRAE la porción de IVA contenida
   * en ese precio final, no la suma aparte. Fórmula estándar SRI:
   * base = precio / (1 + tarifa); iva = precio - base. Se calcula sobre
   * el subtotal de la línea (precio unitario × cantidad) en vez de por
   * unidad y luego multiplicar, para que base + iva == subtotal exacto
   * sin arrastrar diferencias de redondeo entre unidades.
   */
  private calcularIvaDeLineaCentavos(
    subtotalLineaCentavos: number,
    ivaExento: boolean,
  ): number {
    if (ivaExento) return 0;
    const tarifa = this.config.get<number>('impuestos.tarifaIvaGeneral')!;
    const baseImponible = Math.round(subtotalLineaCentavos / (1 + tarifa));
    return subtotalLineaCentavos - baseImponible;
  }

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
  ): Promise<VentaConDesglose> {
    return this.dataSource.transaction(async (manager) => {
      const productoRepo = manager.getRepository(Producto);
      let totalCentavos = 0;
      const items: VentaItem[] = [];

      // Los bloqueos se toman SIEMPRE en el mismo orden (por id), no en
      // el orden del carrito. Si la venta 1 bloquea A y después B, y la
      // venta 2 bloquea B y después A, cada una queda esperando a la
      // otra (deadlock) y Postgres aborta una de las dos. Con orden fijo
      // la segunda simplemente espera. Además cada producto se bloquea
      // una sola vez aunque aparezca en varias líneas.
      const idsOrdenados = [
        ...new Set(dto.items.map((linea) => linea.productoId)),
      ].sort();
      const productos = new Map<string, Producto>();
      for (const id of idsOrdenados) {
        // Bloqueo pesimista: ninguna otra transacción puede leer/escribir
        // esta fila hasta que esta transacción termine. Un producto dado
        // de baja cuenta como inexistente: no se puede vender.
        const producto = await productoRepo.findOne({
          where: { id, tenantId, activo: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!producto) {
          throw new ProductoNoEncontradoError(id);
        }
        productos.set(id, producto);
      }

      for (const linea of dto.items) {
        const producto = productos.get(linea.productoId)!;

        // producto.stock se va descontando en memoria, así que si el
        // mismo producto viene en dos líneas, la segunda se valida contra
        // lo que quedó después de la primera.
        if (producto.stock < linea.cantidad) {
          throw new StockInsuficienteError(
            producto.id,
            producto.stock,
            linea.cantidad,
          );
        }

        producto.stock -= linea.cantidad;

        const subtotalCentavos = producto.precioVentaCentavos * linea.cantidad;
        totalCentavos += subtotalCentavos;

        const item = new VentaItem();
        item.productoId = producto.id;
        item.cantidad = linea.cantidad;
        // Congelamos precio y costo del momento de la venta.
        item.precioVentaCentavos = producto.precioVentaCentavos;
        item.costoUnitarioCentavos = producto.costoUnitarioCentavos;
        item.ivaCentavos = this.calcularIvaDeLineaCentavos(
          subtotalCentavos,
          producto.ivaExento,
        );
        items.push(item);
      }

      await productoRepo.save([...productos.values()]);

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
      const ventaGuardada = await ventaRepo.save(venta);
      const ivaCentavos = this.calcularIvaCentavos(ventaGuardada);

      return {
        ...ventaGuardada,
        ivaCentavos,
        subtotalCentavos: ventaGuardada.totalCentavos - ivaCentavos,
      };
    });
  }

  /**
   * Ganancia real de una venta = suma, por línea, de:
   *   (precioVenta SIN IVA - costoUnitario) * cantidad vendida
   *
   * precioVentaCentavos incluye IVA (precio final al público — así se
   * vende acá), así que hay que restar la porción de IVA de esa línea
   * ANTES de restar el costo. Si no se resta, la "ganancia" queda
   * inflada por el IVA de cada venta, que no es plata del negocio sino
   * plata que hay que declararle al SRI. ivaCentavos ya viene congelado
   * por línea (ver VentaItem), así que este es un cálculo puro, sin
   * necesidad de recalcular nada contra la tarifa vigente.
   *
   * "Cantidad vendida" descuenta lo anulado: unidades devueltas no son
   * ganancia. Nunca el ingreso bruto tampoco (ver riesgo #2 del spec).
   */
  calcularGananciaCentavos(venta: Venta): number {
    return venta.items.reduce((acc, item) => {
      const cantidadVendida = item.cantidad - item.cantidadAnulada;
      const ivaVendido = item.ivaCentavos - item.ivaAnuladoCentavos;
      const subtotalLineaSinIva =
        item.precioVentaCentavos * cantidadVendida - ivaVendido;
      const costoLinea = item.costoUnitarioCentavos * cantidadVendida;
      return acc + (subtotalLineaSinIva - costoLinea);
    }, 0);
  }

  /**
   * IVA total contenido en lo efectivamente vendido (ivaCentavos de cada
   * línea menos la porción anulada, ambos congelados). Útil para que el
   * vendedor sepa cuánto de lo cobrado corresponde a IVA, de cara a su
   * declaración.
   */
  calcularIvaCentavos(venta: Venta): number {
    return venta.items.reduce(
      (acc, item) => acc + item.ivaCentavos - item.ivaAnuladoCentavos,
      0,
    );
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
   *
   * Todo descuenta lo anulado: una venta anulada por completo no cuenta
   * como venta, y las parciales cuentan solo por lo que quedó vendido.
   */
  async obtenerResumenDelDia(tenantId: string): Promise<ResumenDelDiaDto> {
    const inicio = inicioDelDia();

    const ventaRepo = this.dataSource.getRepository(Venta);
    const ventas = await ventaRepo
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.items', 'item')
      .where('venta.tenantId = :tenantId', { tenantId })
      .andWhere('venta.createdAt >= :inicio', { inicio })
      .getMany();

    const ingresoBrutoCentavos = ventas.reduce(
      (acc, venta) => acc + venta.totalCentavos - venta.totalAnuladoCentavos,
      0,
    );
    const gananciaCentavos = ventas.reduce(
      (acc, venta) => acc + this.calcularGananciaCentavos(venta),
      0,
    );
    const ivaCentavos = ventas.reduce(
      (acc, venta) => acc + this.calcularIvaCentavos(venta),
      0,
    );
    const anuladoCentavos = ventas.reduce(
      (acc, venta) => acc + venta.totalAnuladoCentavos,
      0,
    );

    return {
      fecha: fechaLocal(inicio),
      cantidadVentas: ventas.filter(
        (venta) => venta.totalCentavos > venta.totalAnuladoCentavos,
      ).length,
      ingresoBrutoCentavos,
      gananciaCentavos,
      ivaCentavos,
      anuladoCentavos,
    };
  }

  /**
   * Ventas de hoy, de la más reciente a la más vieja, con sus
   * anulaciones. Lo ve cualquier rol (el cajero necesita encontrar la
   * venta para avisarle al admin cuál anular), así que no expone costos.
   */
  async obtenerHistorialDelDia(
    tenantId: string,
  ): Promise<VentaDelHistorialDto[]> {
    const ventas = await this.dataSource
      .getRepository(Venta)
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.usuario', 'vendedor')
      .leftJoinAndSelect('venta.items', 'item')
      .leftJoinAndSelect('item.producto', 'producto')
      .leftJoinAndSelect('venta.anulaciones', 'anulacion')
      .leftJoinAndSelect('anulacion.usuario', 'anuladoPor')
      .where('venta.tenantId = :tenantId', { tenantId })
      .andWhere('venta.createdAt >= :inicio', { inicio: inicioDelDia() })
      .orderBy('venta.createdAt', 'DESC')
      .addOrderBy('anulacion.createdAt', 'ASC')
      .getMany();

    return ventas.map(aVentaDelHistorial);
  }

  /**
   * Anula una venta del día, completa o por producto: devuelve las
   * unidades al stock y registra quién anuló, cuándo y por qué. El
   * ticket original no se toca; lo anulado se acumula en
   * cantidadAnulada / totalAnuladoCentavos, así que se puede anular por
   * partes en varias veces (hasta agotar lo vendido).
   *
   * Solo ventas de hoy: una de otro día ya forma parte de reportes (y
   * de lo que se declaró de IVA) — eso sería una devolución, no una
   * anulación.
   */
  async anularVenta(
    tenantId: string,
    usuarioId: string,
    ventaId: string,
    dto: AnularVentaDto,
  ): Promise<VentaDelHistorialDto> {
    await this.dataSource.transaction(async (manager) => {
      const ventaRepo = manager.getRepository(Venta);
      const itemRepo = manager.getRepository(VentaItem);
      const productoRepo = manager.getRepository(Producto);

      // Lock sobre la venta: dos anulaciones simultáneas de la misma
      // venta (doble click, dos admins) no pueden devolver el mismo
      // stock dos veces. Sin joins: Postgres no permite FOR UPDATE sobre
      // el lado opcional de un LEFT JOIN.
      const venta = await ventaRepo.findOne({
        where: { id: ventaId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!venta) {
        throw new VentaNoEncontradaError(ventaId);
      }
      if (venta.createdAt < inicioDelDia()) {
        throw new VentaDeOtroDiaError();
      }

      const items = await itemRepo.find({
        where: { ventaId },
        relations: { producto: true },
      });
      const itemsPorId = new Map(items.map((item) => [item.id, item]));

      // Qué anular: lo pedido (sumando si una línea viene repetida), o
      // si no se especificó, todo lo que quede.
      const aAnular = new Map<string, number>();
      if (dto.items) {
        for (const linea of dto.items) {
          if (!itemsPorId.has(linea.ventaItemId)) {
            throw new LineaDeOtraVentaError(linea.ventaItemId);
          }
          aAnular.set(
            linea.ventaItemId,
            (aAnular.get(linea.ventaItemId) ?? 0) + linea.cantidad,
          );
        }
      } else {
        for (const item of items) {
          const pendiente = item.cantidad - item.cantidadAnulada;
          if (pendiente > 0) aAnular.set(item.id, pendiente);
        }
        if (aAnular.size === 0) {
          throw new VentaYaAnuladaError();
        }
      }

      for (const [itemId, cantidad] of aAnular) {
        const item = itemsPorId.get(itemId)!;
        const pendiente = item.cantidad - item.cantidadAnulada;
        if (cantidad > pendiente) {
          throw new CantidadAAnularInvalidaError(
            item.producto.nombre,
            pendiente,
            cantidad,
          );
        }
      }

      // Devolver stock bloqueando los productos en orden fijo, igual que
      // crearVenta (evita deadlocks con ventas en curso). Un producto
      // dado de baja igual recupera sus unidades.
      const cantidadPorProducto = new Map<string, number>();
      for (const [itemId, cantidad] of aAnular) {
        const productoId = itemsPorId.get(itemId)!.productoId;
        cantidadPorProducto.set(
          productoId,
          (cantidadPorProducto.get(productoId) ?? 0) + cantidad,
        );
      }
      for (const productoId of [...cantidadPorProducto.keys()].sort()) {
        const producto = await productoRepo.findOne({
          where: { id: productoId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (producto) {
          producto.stock += cantidadPorProducto.get(productoId)!;
          await productoRepo.save(producto);
        }
      }

      let montoDevueltoCentavos = 0;
      const detalle: DetalleAnulacion[] = [];
      for (const [itemId, cantidad] of aAnular) {
        const item = itemsPorId.get(itemId)!;
        const pendiente = item.cantidad - item.cantidadAnulada;
        const ivaPendiente = item.ivaCentavos - item.ivaAnuladoCentavos;
        // IVA proporcional a las unidades anuladas. Si se anula todo lo
        // que queda, se toma el resto exacto para no dejar centavos
        // sueltos por redondeo.
        const ivaAAnular =
          cantidad === pendiente
            ? ivaPendiente
            : Math.min(
                ivaPendiente,
                Math.round((item.ivaCentavos * cantidad) / item.cantidad),
              );

        item.cantidadAnulada += cantidad;
        item.ivaAnuladoCentavos += ivaAAnular;
        montoDevueltoCentavos += item.precioVentaCentavos * cantidad;
        detalle.push({
          ventaItemId: item.id,
          productoId: item.productoId,
          cantidad,
        });
      }
      await itemRepo.save([...aAnular.keys()].map((id) => itemsPorId.get(id)!));

      venta.totalAnuladoCentavos += montoDevueltoCentavos;
      await ventaRepo.save(venta);

      const anulacionRepo = manager.getRepository(AnulacionVenta);
      await anulacionRepo.save(
        anulacionRepo.create({
          tenantId,
          ventaId,
          usuarioId,
          motivo: dto.motivo,
          montoDevueltoCentavos,
          detalle,
        }),
      );
    });

    const historial = await this.obtenerHistorialDelDia(tenantId);
    return historial.find((venta) => venta.id === ventaId)!;
  }
}

function inicioDelDia(): Date {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function aVentaDelHistorial(venta: Venta): VentaDelHistorialDto {
  const estado =
    venta.totalAnuladoCentavos === 0
      ? 'completa'
      : venta.totalAnuladoCentavos >= venta.totalCentavos
        ? 'anulada'
        : 'parcialmente_anulada';

  return {
    id: venta.id,
    createdAt: venta.createdAt,
    vendedor: venta.usuario.nombre,
    totalCentavos: venta.totalCentavos,
    totalAnuladoCentavos: venta.totalAnuladoCentavos,
    montoRecibidoCentavos: venta.montoRecibidoCentavos,
    vueltoCentavos: venta.vueltoCentavos,
    estado,
    items: venta.items.map((item) => ({
      id: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      codigoBarras: item.producto.codigoBarras,
      cantidad: item.cantidad,
      cantidadAnulada: item.cantidadAnulada,
      precioVentaCentavos: item.precioVentaCentavos,
    })),
    anulaciones: venta.anulaciones.map((anulacion) => ({
      id: anulacion.id,
      createdAt: anulacion.createdAt,
      anuladoPor: anulacion.usuario.nombre,
      motivo: anulacion.motivo,
      montoDevueltoCentavos: anulacion.montoDevueltoCentavos,
    })),
  };
}
