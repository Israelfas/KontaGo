import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Producto de una tienda.
 *
 * Decisiones clave del spec reflejadas acá (sección 3.2, 6.3 y 8):
 * - precioVentaCentavos / costoUnitarioCentavos: enteros en centavos, nunca floats.
 * - costoUnitarioCentavos se recalcula como costo promedio ponderado en cada
 *   reabastecimiento (lógica en el servicio de inventario, no acá).
 * - Índice compuesto (tenantId, codigoBarras) para que la búsqueda en el
 *   checkout sea rápida incluso con muchas tiendas concurrentes.
 */
@Entity('productos')
@Index(['tenantId', 'codigoBarras'])
export class Producto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'codigo_barras', length: 64 })
  codigoBarras: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  categoria: string;

  @Column({ length: 150, nullable: true })
  proveedor: string;

  // Precio de venta al público, en centavos.
  @Column({ name: 'precio_venta_centavos', type: 'integer' })
  precioVentaCentavos: number;

  // Costo unitario actual (costo promedio ponderado), en centavos.
  @Column({ name: 'costo_unitario_centavos', type: 'integer', default: 0 })
  costoUnitarioCentavos: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  // Umbral de stock bajo configurable por producto (sección 3.5).
  @Column({ name: 'stock_minimo', type: 'integer', default: 0 })
  stockMinimo: number;

  @Column({ name: 'fecha_vencimiento', type: 'date', nullable: true })
  fechaVencimiento: Date | null;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
