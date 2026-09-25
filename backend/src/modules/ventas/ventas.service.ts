import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Venta } from './entities/venta.entity';
import { VentaItem } from './entities/venta-item.entity';
import { VentaItemLote } from './entities/venta-item-lote.entity';
import { devolverALotes, sacarDeLotes } from '../inventario/lotes';
import {
  registrarMovimiento,
  turnoAbiertoDe,
  turnoCompartido,
} from '../caja/turnos';
import { TipoMovimientoCaja } from '../caja/entities/movimiento-caja.entity';
import { CajaCerradaError, DevolucionSinCajaError } from '../caja/caja.errors';
import type { TurnoCaja } from '../caja/entities/turno-caja.entity';
import { MetodoPago } from '../../common/enums/metodo-pago.enum';
import { CrearVentaDto } from './dto/crear-venta.dto';
import {
  ProductoVendido,
  PuntoSerie,
  ResumenPeriodoDto,
} from './dto/resumen-del-dia.dto';
import { rangoDeHoy, type RangoFechas } from './rango-fechas';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { VentaDelHistorialDto } from './dto/venta-del-historial.dto';
import { TicketDto } from './dto/ticket.dto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { aTiendaDto } from '../tenants/tienda.controller';
import { Rol } from '../../common/enums/rol.enum';
import {
  AnulacionVenta,
  DetalleAnulacion,
} from './entities/anulacion-venta.entity';
import { fechaLocal } from '../../common/formato-fecha';
import {
  CantidadAAnularInvalidaError,
  FaltaMontoRecibidoError,
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
    const metodoPago = dto.metodoPago ?? MetodoPago.EFECTIVO;
    if (
      metodoPago === MetodoPago.EFECTIVO &&
      dto.montoRecibidoCentavos === undefined
    ) {
      throw new FaltaMontoRecibidoError();
    }

    return this.dataSource.transaction(async (manager) => {
      // Sin caja abierta no se cobra: toda venta tiene que caer en un
      // turno, si no el arqueo no cuadra. Bloqueo compartido: el cierre
      // de caja espera a que termine esta venta (ver caja/turnos.ts).
      const turno = await turnoAbiertoDe(
        manager,
        tenantId,
        usuarioId,
        'compartido',
      );
      if (!turno) throw new CajaCerradaError();

      const productoRepo = manager.getRepository(Producto);
      let totalCentavos = 0;
      const items: VentaItem[] = [];
      // De qué lotes salió cada línea (mismo índice que items).
      const deLotesPorLinea: { loteId: string; cantidad: number }[][] = [];

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
        // Del lote que vence antes (FEFO); nada si el producto no vence.
        deLotesPorLinea.push(
          await sacarDeLotes(manager, producto, linea.cantidad),
        );

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

      // Transferencia: se paga el total exacto, sin vuelto.
      const montoRecibidoCentavos =
        metodoPago === MetodoPago.TRANSFERENCIA
          ? totalCentavos
          : dto.montoRecibidoCentavos!;
      if (montoRecibidoCentavos < totalCentavos) {
        throw new MontoRecibidoInsuficienteError(
          totalCentavos,
          montoRecibidoCentavos,
        );
      }

      const venta = new Venta();
      venta.tenantId = tenantId;
      venta.usuarioId = usuarioId;
      venta.turnoId = turno.id;
      venta.metodoPago = metodoPago;
      venta.totalCentavos = totalCentavos;
      venta.montoRecibidoCentavos = montoRecibidoCentavos;
      venta.vueltoCentavos = montoRecibidoCentavos - totalCentavos;
      venta.items = items;

      // El número de ticket va al final, justo antes de guardar: el contador
      // de la tienda queda bloqueado hasta el commit, así que cuanto menos
      // dure, menos esperan las otras cajas. Si algo falla después, el
      // rollback deshace también el incremento (no quedan saltos).
      // Con Postgres, TypeORM devuelve un UPDATE … RETURNING como
      // [filas, cantidad de filas afectadas].
      const [filas] = await manager.query<
        [{ ultimo_numero_venta: number }[], number]
      >(
        `UPDATE tenants SET ultimo_numero_venta = ultimo_numero_venta + 1
          WHERE id = $1 RETURNING ultimo_numero_venta`,
        [tenantId],
      );
      venta.numero = filas[0].ultimo_numero_venta;

      const ventaRepo = manager.getRepository(Venta);
      const ventaGuardada = await ventaRepo.save(venta);

      const consumos = ventaGuardada.items.flatMap((item, i) =>
        deLotesPorLinea[i].map((paso) =>
          manager.getRepository(VentaItemLote).create({
            ventaItemId: item.id,
            loteId: paso.loteId,
            cantidad: paso.cantidad,
          }),
        ),
      );
      if (consumos.length > 0) {
        await manager.getRepository(VentaItemLote).save(consumos);
      }
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
    return venta.items.reduce(
      (acc, item) => acc + this.calcularGananciaDeLineaCentavos(item),
      0,
    );
  }

  /** La ganancia de una línea (lo mismo que suma calcularGananciaCentavos). */
  calcularGananciaDeLineaCentavos(item: VentaItem): number {
    const cantidadVendida = item.cantidad - item.cantidadAnulada;
    const ivaVendido = item.ivaCentavos - item.ivaAnuladoCentavos;
    const subtotalLineaSinIva =
      item.precioVentaCentavos * cantidadVendida - ivaVendido;
    const costoLinea = item.costoUnitarioCentavos * cantidadVendida;
    return subtotalLineaSinIva - costoLinea;
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
   * Resumen de un período: ingreso, ganancia real, IVA y anulado, más la
   * serie para el gráfico (por hora si es un día, por día si es un rango)
   * y los productos más vendidos.
   *
   * Todo descuenta lo anulado: una venta anulada por completo no cuenta
   * como venta, y las parciales cuentan solo por lo que quedó vendido.
   *
   * Se calcula en vivo sobre las ventas del período, reutilizando la misma
   * fórmula de ganancia e IVA que el resto (una sola fuente de verdad).
   * Para un minimarket, 92 días son unos pocos miles de ventas: liviano.
   * Si el volumen crece mucho (cadenas, multi-sucursal), el paso siguiente
   * es una tabla agregada por día (riesgo #4 del spec), no subir el tope.
   */
  async obtenerResumen(
    tenantId: string,
    rango: RangoFechas,
  ): Promise<ResumenPeriodoDto> {
    const ventas = await this.dataSource
      .getRepository(Venta)
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.items', 'item')
      .leftJoinAndSelect('item.producto', 'producto')
      .where('venta.tenantId = :tenantId', { tenantId })
      .andWhere('venta.createdAt >= :inicio', { inicio: rango.inicio })
      .andWhere('venta.createdAt < :fin', { fin: rango.finExclusivo })
      .getMany();

    const neto = (venta: Venta) =>
      venta.totalCentavos - venta.totalAnuladoCentavos;
    const agrupadoPor = rango.dias === 1 ? 'hora' : 'dia';

    return {
      fecha: rango.desde,
      desde: rango.desde,
      hasta: rango.hasta,
      dias: rango.dias,
      cantidadVentas: ventas.filter((venta) => neto(venta) > 0).length,
      ingresoBrutoCentavos: ventas.reduce((acc, venta) => acc + neto(venta), 0),
      gananciaCentavos: ventas.reduce(
        (acc, venta) => acc + this.calcularGananciaCentavos(venta),
        0,
      ),
      ivaCentavos: ventas.reduce(
        (acc, venta) => acc + this.calcularIvaCentavos(venta),
        0,
      ),
      anuladoCentavos: ventas.reduce(
        (acc, venta) => acc + venta.totalAnuladoCentavos,
        0,
      ),
      // Lo cobrado, separado por cómo se pagó.
      efectivoCentavos: ventas
        .filter((venta) => venta.metodoPago === MetodoPago.EFECTIVO)
        .reduce((acc, venta) => acc + neto(venta), 0),
      transferenciaCentavos: ventas
        .filter((venta) => venta.metodoPago === MetodoPago.TRANSFERENCIA)
        .reduce((acc, venta) => acc + neto(venta), 0),
      agrupadoPor,
      serie:
        agrupadoPor === 'hora'
          ? serieHoraria(ventas, neto)
          : serieDiaria(ventas, neto, rango),
      topProductos: masVendidos(ventas),
    };
  }

  /** Resumen de hoy (lo que usa /ventas/resumen-dia). */
  async obtenerResumenDelDia(tenantId: string): Promise<ResumenPeriodoDto> {
    return this.obtenerResumen(tenantId, rangoDeHoy());
  }

  /**
   * Ventas de un período, de la más reciente a la más vieja, paginadas: un
   * mes entero puede tener más de mil. Mismo formato que el historial del
   * día (sin costos), para que la pantalla sea la misma.
   */
  async listarVentas(
    tenantId: string,
    rango: RangoFechas,
    limite = 50,
    desplazamiento = 0,
    numero?: number,
  ): Promise<{ ventas: VentaDelHistorialDto[]; total: number }> {
    const consulta = this.dataSource
      .getRepository(Venta)
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.usuario', 'vendedor')
      .leftJoinAndSelect('venta.items', 'item')
      .leftJoinAndSelect('item.producto', 'producto')
      .leftJoinAndSelect('venta.anulaciones', 'anulacion')
      .leftJoinAndSelect('anulacion.usuario', 'anuladoPor')
      .where('venta.tenantId = :tenantId', { tenantId });
    // Buscar un ticket por su número: de cualquier fecha.
    if (numero !== undefined) {
      consulta.andWhere('venta.numero = :numero', { numero });
    } else {
      consulta
        .andWhere('venta.createdAt >= :inicio', { inicio: rango.inicio })
        .andWhere('venta.createdAt < :fin', { fin: rango.finExclusivo });
    }
    const [ventas, total] = await consulta
      .orderBy('venta.createdAt', 'DESC')
      .addOrderBy('anulacion.createdAt', 'ASC')
      .skip(desplazamiento)
      .take(limite)
      .getManyAndCount();

    return { ventas: ventas.map(aVentaDelHistorial), total };
  }

  /**
   * Todas las ventas de un período, de la más vieja a la más nueva, con su
   * vendedor y sus productos: lo que necesita el reporte en Excel. Sin
   * paginar: 92 días de un minimarket son unos pocos miles de ventas.
   */
  async ventasDelPeriodo(
    tenantId: string,
    rango: RangoFechas,
  ): Promise<Venta[]> {
    return this.dataSource
      .getRepository(Venta)
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.usuario', 'vendedor')
      .leftJoinAndSelect('venta.items', 'item')
      .leftJoinAndSelect('item.producto', 'producto')
      .where('venta.tenantId = :tenantId', { tenantId })
      .andWhere('venta.createdAt >= :inicio', { inicio: rango.inicio })
      .andWhere('venta.createdAt < :fin', { fin: rango.finExclusivo })
      .orderBy('venta.createdAt', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .getMany();
  }

  /**
   * Ventas de hoy, de la más reciente a la más vieja, con sus
   * anulaciones. Lo ve cualquier rol (el cajero necesita encontrar la
   * venta para avisarle al admin cuál anular), así que no expone costos.
   */
  /**
   * El ticket de una venta, para imprimir o compartir. El admin, de
   * cualquier día; el cajero, de las de hoy (las mismas que ve en su
   * historial).
   */
  async obtenerTicket(
    tenantId: string,
    rol: Rol,
    ventaId: string,
  ): Promise<TicketDto> {
    const venta = await this.dataSource.getRepository(Venta).findOne({
      where: { id: ventaId, tenantId },
      relations: { usuario: true, items: { producto: true } },
    });
    if (!venta) throw new VentaNoEncontradaError(ventaId);
    if (rol !== Rol.ADMIN && venta.createdAt < inicioDelDia()) {
      throw new VentaNoEncontradaError(ventaId);
    }
    const tenant = await this.dataSource
      .getRepository(Tenant)
      .findOneByOrFail({ id: tenantId });

    // Sin IVA = línea exenta (tarifa 0%): su IVA congelado es 0.
    const conIva = venta.items.filter((item) => item.ivaCentavos > 0);
    const sinIva = venta.items.filter((item) => item.ivaCentavos === 0);
    const bruto = (item: VentaItem) => item.precioVentaCentavos * item.cantidad;
    const ivaCentavos = conIva.reduce((acc, item) => acc + item.ivaCentavos, 0);

    return {
      tienda: aTiendaDto(tenant),
      numero: venta.numero,
      fecha: venta.createdAt,
      cajero: venta.usuario.nombre,
      metodoPago: venta.metodoPago,
      lineas: venta.items.map((item) => ({
        nombre: item.producto.nombre,
        cantidad: item.cantidad,
        precioUnitarioCentavos: item.precioVentaCentavos,
        totalCentavos: bruto(item),
        cantidadAnulada: item.cantidadAnulada,
      })),
      subtotalConIvaCentavos:
        conIva.reduce((acc, item) => acc + bruto(item), 0) - ivaCentavos,
      subtotalSinIvaCentavos: sinIva.reduce(
        (acc, item) => acc + bruto(item),
        0,
      ),
      ivaCentavos,
      tarifaIva: Math.round(
        this.config.get<number>('impuestos.tarifaIvaGeneral')! * 100,
      ),
      totalCentavos: venta.totalCentavos,
      montoRecibidoCentavos: venta.montoRecibidoCentavos,
      vueltoCentavos: venta.vueltoCentavos,
      anuladoCentavos: venta.totalAnuladoCentavos,
    };
  }

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

      // El efectivo que se devuelve sale de un cajón. Si el turno de la
      // venta sigue abierto, basta con descontarla (su arqueo la ve con
      // menos). Si ya se cerró (su efectivo ya se contó), la devolución
      // sale de la caja abierta de quien anula, como un retiro.
      let cajaDeLaDevolucion: TurnoCaja | null = null;
      if (venta.metodoPago === MetodoPago.EFECTIVO && venta.turnoId) {
        const turnoDeLaVenta = await turnoCompartido(manager, venta.turnoId);
        if (turnoDeLaVenta?.cerradoEn) {
          cajaDeLaDevolucion = await turnoAbiertoDe(
            manager,
            tenantId,
            usuarioId,
            'compartido',
          );
          if (!cajaDeLaDevolucion) throw new DevolucionSinCajaError();
        }
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
      // dado de baja igual recupera sus unidades. Cada línea devuelve sus
      // unidades a los lotes de los que salieron.
      const lineasPorProducto = new Map<string, [string, number][]>();
      for (const [itemId, cantidad] of aAnular) {
        const productoId = itemsPorId.get(itemId)!.productoId;
        lineasPorProducto.set(productoId, [
          ...(lineasPorProducto.get(productoId) ?? []),
          [itemId, cantidad],
        ]);
      }
      for (const productoId of [...lineasPorProducto.keys()].sort()) {
        const producto = await productoRepo.findOne({
          where: { id: productoId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!producto) continue;
        for (const [itemId, cantidad] of lineasPorProducto.get(productoId)!) {
          // Antes de sumar al stock (ver devolverALotes).
          await devolverALotes(manager, producto, itemId, cantidad);
          producto.stock += cantidad;
        }
        await productoRepo.save(producto);
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
      if (cajaDeLaDevolucion) {
        const hora = venta.createdAt.toLocaleTimeString('es-EC', {
          hour: '2-digit',
          minute: '2-digit',
        });
        await registrarMovimiento(
          manager,
          cajaDeLaDevolucion,
          usuarioId,
          TipoMovimientoCaja.RETIRO,
          montoDevueltoCentavos,
          `Devolución del ticket ${numeroDeTicket(venta.numero)} de las ${hora} (turno ya cerrado)`,
        );
      }
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

/**
 * Por hora, de la primera a la última hora con ventas. Las horas del medio
 * sin ventas van con 0: un hueco es un dato (a esa hora no se vendió).
 */
function serieHoraria(
  ventas: Venta[],
  neto: (v: Venta) => number,
): PuntoSerie[] {
  if (ventas.length === 0) return [];
  const porHora = new Map<number, number>();
  for (const venta of ventas) {
    const hora = venta.createdAt.getHours();
    porHora.set(hora, (porHora.get(hora) ?? 0) + neto(venta));
  }
  const horas = [...porHora.keys()];
  const desde = Math.min(...horas);
  const hasta = Math.max(...horas);
  return Array.from({ length: hasta - desde + 1 }, (_, i) => ({
    etiqueta: String(desde + i),
    centavos: porHora.get(desde + i) ?? 0,
  }));
}

/** Por día, todos los días del rango (con 0 los que no tuvieron ventas). */
function serieDiaria(
  ventas: Venta[],
  neto: (v: Venta) => number,
  rango: RangoFechas,
): PuntoSerie[] {
  const porDia = new Map<string, number>();
  for (const venta of ventas) {
    const dia = fechaLocal(venta.createdAt);
    porDia.set(dia, (porDia.get(dia) ?? 0) + neto(venta));
  }
  const serie: PuntoSerie[] = [];
  for (
    const d = new Date(rango.inicio);
    d < rango.finExclusivo;
    d.setDate(d.getDate() + 1)
  ) {
    const etiqueta = fechaLocal(d);
    serie.push({ etiqueta, centavos: porDia.get(etiqueta) ?? 0 });
  }
  return serie;
}

/** Los 5 productos con más unidades vendidas (descontando lo anulado). */
function masVendidos(ventas: Venta[]): ProductoVendido[] {
  const porProducto = new Map<string, ProductoVendido>();
  for (const venta of ventas) {
    for (const item of venta.items) {
      const unidades = item.cantidad - item.cantidadAnulada;
      if (unidades <= 0) continue;
      const previo = porProducto.get(item.productoId) ?? {
        nombre: item.producto?.nombre ?? 'Producto',
        unidades: 0,
        centavos: 0,
      };
      previo.unidades += unidades;
      previo.centavos += item.precioVentaCentavos * unidades;
      porProducto.set(item.productoId, previo);
    }
  }
  return [...porProducto.values()]
    .sort((a, b) => b.unidades - a.unidades || b.centavos - a.centavos)
    .slice(0, 5);
}

function inicioDelDia(): Date {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

/** "#0245": el número como se imprime y se dice ("anulá la 245"). */
export function numeroDeTicket(numero: number): string {
  return `#${String(numero).padStart(4, '0')}`;
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
    numero: venta.numero,
    metodoPago: venta.metodoPago,
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
