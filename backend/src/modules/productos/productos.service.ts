import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { AlertasProductosDto } from './dto/alertas-productos.dto';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

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
      fechaVencimiento: dto.fechaVencimiento
        ? new Date(dto.fechaVencimiento)
        : null,
    });

    return this.productoRepo.save(producto);
  }

  /**
   * Usado en el flujo de escaneo (3.1 y 3.2 del spec): si el código de
   * barras ya existe para esta tienda, se devuelve el producto para
   * autocompletar (alta) o agregar directo al ticket (venta).
   */
  async buscarPorCodigoBarras(
    tenantId: string,
    codigoBarras: string,
  ): Promise<Producto | null> {
    return this.productoRepo.findOne({ where: { tenantId, codigoBarras } });
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

    const limiteVencimiento = new Date();
    limiteVencimiento.setDate(limiteVencimiento.getDate() + diasVencimiento);
    limiteVencimiento.setHours(23, 59, 59, 999);

    const porVencer = await this.productoRepo.find({
      where: {
        tenantId,
        activo: true,
        fechaVencimiento: LessThanOrEqual(limiteVencimiento),
      },
      order: { fechaVencimiento: 'ASC' },
    });

    return { stockBajo, porVencer };
  }
}
