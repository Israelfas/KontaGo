import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { AlertasProductosDto } from './dto/alertas-productos.dto';
import { fechaLocal } from '../../common/formato-fecha';
import {
  CodigoBarrasDuplicadoError,
  CodigoBarrasEnUsoAlReactivarError,
} from './productos.errors';

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
    const producto = await this.buscarPorId(tenantId, id);

    if (dto.nombre !== undefined) producto.nombre = dto.nombre;
    if (dto.categoria !== undefined) producto.categoria = dto.categoria;
    if (dto.proveedor !== undefined) producto.proveedor = dto.proveedor;
    if (dto.precioVentaCentavos !== undefined)
      producto.precioVentaCentavos = dto.precioVentaCentavos;
    if (dto.costoUnitarioCentavos !== undefined)
      producto.costoUnitarioCentavos = dto.costoUnitarioCentavos;
    if (dto.stockMinimo !== undefined) producto.stockMinimo = dto.stockMinimo;
    if (dto.ivaExento !== undefined) producto.ivaExento = dto.ivaExento;

    if (dto.quitarFechaVencimiento) {
      producto.fechaVencimiento = null;
    } else if (dto.fechaVencimiento !== undefined) {
      producto.fechaVencimiento = dto.fechaVencimiento;
    }

    return this.productoRepo.save(producto);
  }

  async crear(tenantId: string, dto: CrearProductoDto): Promise<Producto> {
    const producto = this.productoRepo.create({
      tenantId,
      codigoBarras: dto.codigoBarras,
      nombre: dto.nombre,
      categoria: dto.categoria,
      proveedor: dto.proveedor,
      precioVentaCentavos: dto.precioVentaCentavos,
      costoUnitarioCentavos: dto.costoUnitarioCentavos ?? 0,
      stock: dto.stockInicial ?? 0,
      stockMinimo: dto.stockMinimo ?? 0,
      fechaVencimiento: dto.fechaVencimiento ?? null,
      ivaExento: dto.ivaExento ?? false,
    });

    try {
      return await this.productoRepo.save(producto);
    } catch (error) {
      // Confiamos en la restricción de la base como fuente de verdad
      // (evita condiciones de carrera de un chequeo previo tipo "buscar y
      // luego crear"), y solo traducimos el error crudo de Postgres a un
      // mensaje entendible para el cliente.
      if (esViolacionDeUnicidad(error)) {
        throw new CodigoBarrasDuplicadoError(dto.codigoBarras);
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
    return this.productoRepo.save(producto);
  }

  async reactivar(tenantId: string, id: string): Promise<Producto> {
    const producto = await this.buscarPorId(tenantId, id);
    if (producto.activo) return producto;

    producto.activo = true;
    try {
      return await this.productoRepo.save(producto);
    } catch (error) {
      // Mientras estaba dado de baja se cargó otro producto con su código.
      if (esViolacionDeUnicidad(error)) {
        throw new CodigoBarrasEnUsoAlReactivarError(producto.codigoBarras);
      }
      throw error;
    }
  }

  async listarDadosDeBaja(tenantId: string): Promise<Producto[]> {
    return this.productoRepo.find({
      where: { tenantId, activo: false },
      order: { updatedAt: 'DESC' },
    });
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
    return this.productoRepo.find({
      where: { tenantId, activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Alertas configurables (sección 3.5 del spec):
   * - Stock bajo: el umbral es por producto (stockMinimo), no global.
   *   Un producto con stockMinimo=0 nunca alerta (0 = "no me importa
   *   este umbral para este producto", el default al crear un producto).
   * - Por vencer: productos con fecha de vencimiento dentro de los
   *   próximos `diasVencimiento` días. Es "tiempo configurable por el
   *   usuario" vía parámetro, con 7 días de default.
   */
  async obtenerAlertas(
    tenantId: string,
    diasVencimiento = 7,
  ): Promise<AlertasProductosDto> {
    const todosActivos = await this.productoRepo.find({
      where: { tenantId, activo: true },
      order: { nombre: 'ASC' },
    });

    const stockBajo = todosActivos.filter(
      (p) => p.stockMinimo > 0 && p.stock <= p.stockMinimo,
    );

    // Rango [hoy, límite]: sin el piso de "hoy", un producto vencido hace
    // meses también entraba acá para siempre (cualquier fecha <= límite
    // incluye el pasado completo) — el correo diario habría seguido
    // alertando sobre stock ya vencido indefinidamente, en vez de mostrar
    // solo lo que realmente está por vencer en los próximos días.
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + diasVencimiento);

    const porVencer = await this.productoRepo.find({
      where: {
        tenantId,
        activo: true,
        fechaVencimiento: Between(fechaLocal(hoy), fechaLocal(limite)),
      },
      order: { fechaVencimiento: 'ASC' },
    });

    return { stockBajo, porVencer };
  }
}
