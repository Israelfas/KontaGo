import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { AlertasProductosDto } from './dto/alertas-productos.dto';
import { fechaLocal } from '../../common/formato-fecha';
import {
  CodigoBarrasDuplicadoError,
  CodigoBarrasEnUsoAlReactivarError,
  FechaSinStockError,
  UnidadConStockDecimalError,
  VariosLotesError,
} from './productos.errors';
import {
  agregarAlLote,
  fechaMasProxima,
  lotesDelProducto,
  ordenFEFO,
} from '../inventario/lotes';
import { Lote } from '../inventario/entities/lote.entity';
import { generarCodigoInterno } from './codigo-interno';
import { revisarCantidad } from './cantidad-del-producto';
import { UnidadDeVenta } from '../../common/cantidad';

/** Deja en `lotes` solo los que tienen unidades, del que vence antes al último. */
function conLotesVigentes(producto: Producto): Producto {
  producto.lotes = (producto.lotes ?? [])
    .filter((lote) => lote.cantidad > 0)
    .sort(ordenFEFO);
  return producto;
}

// 23505 = unique_violation en Postgres (acá, el índice de código de
// barras único entre productos activos).
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  /**
   * Edición parcial (PATCH): solo toca los campos que vengan en el DTO.
   * codigoBarras nunca se edita acá — es la identidad del producto.
   */
  async actualizar(
    tenantId: string,
    id: string,
    dto: ActualizarProductoDto,
  ): Promise<Producto> {
    return this.productoRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Producto);
      const producto = await repo.findOne({
        where: { tenantId, id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new NotFoundException(`Producto ${id} no encontrado`);
      }

      if (dto.nombre !== undefined) producto.nombre = dto.nombre;
      if (dto.categoria !== undefined) producto.categoria = dto.categoria;
      if (dto.proveedor !== undefined) producto.proveedor = dto.proveedor;
      if (dto.precioVentaCentavos !== undefined)
        producto.precioVentaCentavos = dto.precioVentaCentavos;
      if (dto.costoUnitarioCentavos !== undefined)
        producto.costoUnitarioCentavos = dto.costoUnitarioCentavos;
      if (dto.unidad !== undefined && dto.unidad !== producto.unidad) {
        // A "por unidad" solo si lo que hay se puede contar en enteros.
        if (
          dto.unidad === UnidadDeVenta.UNIDAD &&
          !Number.isInteger(producto.stock)
        ) {
          throw new UnidadConStockDecimalError(producto.stock);
        }
        producto.unidad = dto.unidad;
      }
      if (dto.stockMinimo !== undefined) {
        revisarCantidad(producto, dto.stockMinimo);
        producto.stockMinimo = dto.stockMinimo;
      }
      if (dto.ivaExento !== undefined) producto.ivaExento = dto.ivaExento;

      if (dto.quitarFechaVencimiento) {
        await this.cambiarFechaUnica(manager, producto, null);
      } else if (dto.fechaVencimiento !== undefined) {
        await this.cambiarFechaUnica(manager, producto, dto.fechaVencimiento);
      }

      const guardado = await repo.save(producto);
      guardado.lotes = await lotesDelProducto(manager, guardado.id);
      return conLotesVigentes(guardado);
    });
  }

  /**
   * "La fecha de vencimiento" de un producto, como se editaba antes de
   * los lotes: vale mientras el producto tenga un solo lote con unidades
   * (se corrige ese lote). Con varios, cada fecha se corrige desde
   * Inventario → Lotes.
   */
  private async cambiarFechaUnica(
    manager: EntityManager,
    producto: Producto,
    fecha: string | null,
  ) {
    const lotes = await lotesDelProducto(manager, producto.id);
    const conUnidades = lotes.filter((lote) => lote.cantidad > 0);

    if (conUnidades.length > 1) {
      throw new VariosLotesError(conUnidades.length);
    }
    if (conUnidades.length === 1) {
      conUnidades[0].fechaVencimiento = fecha;
      await manager.getRepository(Lote).save(conUnidades[0]);
      producto.fechaVencimiento = fechaMasProxima(lotes);
      return;
    }
    // Sin lotes con unidades: el stock (si hay) no tenía fecha.
    if (fecha === null) {
      producto.fechaVencimiento = null;
      return;
    }
    if (producto.stock <= 0) throw new FechaSinStockError();
    const stock = producto.stock;
    // agregarAlLote espera el stock de antes de sumar: acá no se suma
    // nada, todo el stock existente pasa al lote de esa fecha.
    producto.stock = 0;
    await agregarAlLote(manager, producto, stock, fecha);
    producto.stock = stock;
  }

  async crear(tenantId: string, dto: CrearProductoDto): Promise<Producto> {
    if (dto.fechaVencimiento && (dto.stockInicial ?? 0) <= 0) {
      throw new FechaSinStockError();
    }
    const comoSeVende = {
      nombre: dto.nombre,
      unidad: dto.unidad ?? UnidadDeVenta.UNIDAD,
    };
    revisarCantidad(comoSeVende, dto.stockInicial ?? 0);
    revisarCantidad(comoSeVende, dto.stockMinimo ?? 0);
    const codigo = dto.codigoBarras?.trim();
    if (codigo) return this.crearConCodigo(tenantId, dto, codigo);

    // Sin código de barras: uno interno. Chocar con otro es casi imposible
    // (10 dígitos al azar), pero si pasa se prueba con otro.
    for (let intento = 1; ; intento++) {
      try {
        return await this.crearConCodigo(tenantId, dto, generarCodigoInterno());
      } catch (error) {
        if (!(error instanceof CodigoBarrasDuplicadoError) || intento >= 5) {
          throw error;
        }
      }
    }
  }

  private async crearConCodigo(
    tenantId: string,
    dto: CrearProductoDto,
    codigoBarras: string,
  ): Promise<Producto> {
    const stockInicial = dto.stockInicial ?? 0;
    const producto = this.productoRepo.create({
      tenantId,
      codigoBarras,
      nombre: dto.nombre,
      categoria: dto.categoria,
      proveedor: dto.proveedor,
      precioVentaCentavos: dto.precioVentaCentavos,
      costoUnitarioCentavos: dto.costoUnitarioCentavos ?? 0,
      stock: 0,
      stockMinimo: dto.stockMinimo ?? 0,
      unidad: dto.unidad ?? UnidadDeVenta.UNIDAD,
      fechaVencimiento: null,
      ivaExento: dto.ivaExento ?? false,
    });

    try {
      return await this.productoRepo.manager.transaction(async (manager) => {
        const repo = manager.getRepository(Producto);
        const guardado = await repo.save(producto);
        // El stock inicial con fecha es el primer lote del producto.
        if (dto.fechaVencimiento) {
          await agregarAlLote(
            manager,
            guardado,
            stockInicial,
            dto.fechaVencimiento,
          );
        }
        guardado.stock = stockInicial;
        const conStock = await repo.save(guardado);
        conStock.lotes = await lotesDelProducto(manager, conStock.id);
        return conLotesVigentes(conStock);
      });
    } catch (error) {
      // Confiamos en la restricción de la base como fuente de verdad
      // (evita condiciones de carrera de un chequeo previo tipo "buscar y
      // luego crear"), y solo traducimos el error crudo de Postgres a un
      // mensaje entendible para el cliente.
      if (esViolacionDeUnicidad(error)) {
        throw new CodigoBarrasDuplicadoError(codigoBarras);
      }
      throw error;
    }
  }

  /**
   * Baja lógica: el producto no se borra porque sus ventas y movimientos
   * pasados lo siguen referenciando (y los reportes necesitan su costo
   * congelado). Deja de aparecer en el catálogo, el escaneo y las
   * alertas, no se puede vender, y su código de barras queda libre para
   * cargar un producto nuevo.
   */
  async darDeBaja(tenantId: string, id: string): Promise<Producto> {
    const producto = await this.buscarPorId(tenantId, id);
    producto.activo = false;
    return this.conLotes(await this.productoRepo.save(producto));
  }

  async reactivar(tenantId: string, id: string): Promise<Producto> {
    const producto = await this.buscarPorId(tenantId, id);
    if (producto.activo) return producto;

    producto.activo = true;
    try {
      return await this.conLotes(await this.productoRepo.save(producto));
    } catch (error) {
      // Mientras estaba dado de baja se cargó otro producto con su código.
      if (esViolacionDeUnicidad(error)) {
        throw new CodigoBarrasEnUsoAlReactivarError(producto.codigoBarras);
      }
      throw error;
    }
  }

  async listarDadosDeBaja(tenantId: string): Promise<Producto[]> {
    const productos = await this.productoRepo.find({
      where: { tenantId, activo: false },
      relations: { lotes: true },
      order: { updatedAt: 'DESC' },
    });
    return productos.map(conLotesVigentes);
  }

  /** Los mismos datos que el listado: el producto con sus lotes vigentes. */
  private async conLotes(producto: Producto): Promise<Producto> {
    producto.lotes = await lotesDelProducto(
      this.productoRepo.manager,
      producto.id,
    );
    return conLotesVigentes(producto);
  }

  /**
   * Usado en el flujo de escaneo (3.1 y 3.2 del spec): si el código de
   * barras ya existe para esta tienda, se devuelve el producto para
   * autocompletar (alta) o agregar directo al ticket (venta). Un producto
   * dado de baja (activo = false) no aparece, igual que en listar().
   */
  async buscarPorCodigoBarras(
    tenantId: string,
    codigoBarras: string,
  ): Promise<Producto | null> {
    return this.productoRepo.findOne({
      where: { tenantId, codigoBarras, activo: true },
    });
  }

  async buscarPorId(tenantId: string, id: string): Promise<Producto> {
    const producto = await this.productoRepo.findOne({
      where: { tenantId, id },
    });
    if (!producto) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    return producto;
  }

  async listar(tenantId: string): Promise<Producto[]> {
    const productos = await this.productoRepo.find({
      where: { tenantId, activo: true },
      relations: { lotes: true },
      order: { nombre: 'ASC' },
    });
    return productos.map(conLotesVigentes);
  }

  /**
   * Alertas configurables (sección 3.5 del spec):
   * - Stock bajo: el umbral es por producto (stockMinimo), no global.
   *   Un producto con stockMinimo=0 nunca alerta (0 = "no me importa
   *   este umbral para este producto", el default al crear un producto).
   * - Por vencer: productos con algún lote (con unidades) que vence
   *   dentro de los próximos `diasVencimiento` días. Es "tiempo
   *   configurable por el usuario" vía parámetro, con 7 días de default.
   * - Vencidos: productos con algún lote (con unidades) ya vencido: hay
   *   mercadería en la góndola que no se puede vender.
   *
   * Por lote y no por producto: con la leche del 28 y la del 5 en la
   * góndola, la del 28 tiene que avisar aunque la otra esté bien.
   */
  async obtenerAlertas(
    tenantId: string,
    diasVencimiento = 7,
  ): Promise<AlertasProductosDto> {
    const todosActivos = (
      await this.productoRepo.find({
        where: { tenantId, activo: true },
        relations: { lotes: true },
        order: { nombre: 'ASC' },
      })
    ).map(conLotesVigentes);

    const stockBajo = todosActivos.filter(
      (p) => p.stockMinimo > 0 && p.stock <= p.stockMinimo,
    );

    // Rango [hoy, límite]: sin el piso de "hoy", un producto vencido hace
    // meses también entraba acá para siempre (cualquier fecha <= límite
    // incluye el pasado completo) — el correo diario habría seguido
    // alertando sobre stock ya vencido indefinidamente, en vez de mostrar
    // solo lo que realmente está por vencer en los próximos días.
    const hoy = fechaLocal(new Date());
    const limite = new Date();
    limite.setDate(limite.getDate() + diasVencimiento);
    const hasta = fechaLocal(limite);

    // Fechas de los lotes con unidades, de la más próxima a la última
    // ('AAAA-MM-DD' se compara como texto).
    const fechas = (p: Producto): string[] =>
      (p.lotes ?? []).flatMap((l) =>
        l.fechaVencimiento === null ? [] : [l.fechaVencimiento],
      );
    const primeraPorVencer = (p: Producto) =>
      fechas(p).find((f) => f >= hoy && f <= hasta);

    const porVencer = todosActivos
      .filter((p) => primeraPorVencer(p) !== undefined)
      .sort((a, b) => primeraPorVencer(a)!.localeCompare(primeraPorVencer(b)!));
    const vencidos = todosActivos.filter((p) => fechas(p).some((f) => f < hoy));

    return { stockBajo, porVencer, vencidos };
  }
}
