import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Lote } from '../../inventario/entities/lote.entity';

/**
 * Producto de una tienda.
 *
 * Decisiones clave del spec reflejadas acá (sección 3.2, 6.3 y 8):
 * - precioVentaCentavos / costoUnitarioCentavos: enteros en centavos, nunca floats.
 * - costoUnitarioCentavos se recalcula como costo promedio ponderado en cada
 *   reabastecimiento (lógica en el servicio de inventario, no acá).
 * - Índice único compuesto (tenantId, codigoBarras) entre productos
 *   ACTIVOS: la búsqueda en el checkout es rápida incluso con muchas
 *   tiendas concurrentes, y de paso impide dos productos activos con el
 *   mismo código en la misma tienda — antes de la restricción única, el
 *   escaneo podía devolver un producto arbitrario entre duplicados (ver
 *   migración CodigoBarrasUnico). Un producto dado de baja libera su
 *   código (ver migración CodigoBarrasUnicoSoloActivos).
 */
@Entity('productos')
@Index('IDX_productos_tenant_codigo_activo', ['tenantId', 'codigoBarras'], {
  unique: true,
  where: '"activo" = true',
})
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

  // Con lotes, es la fecha del lote con unidades que vence antes (se
  // recalcula en cada movimiento, ver inventario/lotes.ts): la muestran
  // las listas y el filtro "por vencer" sin tener que cargar los lotes.
  // Sin lotes (productos que no vencen) queda en null.
  //
  // 'AAAA-MM-DD' como texto, no Date: es una fecha de calendario, sin
  // hora ni zona horaria. TypeORM ya devuelve las columnas `date` como
  // string; y al revés, un Date se convierte con la hora LOCAL del
  // servidor, así que new Date('2026-09-30') (medianoche UTC) en Ecuador
  // se guardaba como el 29.
  @Column({ name: 'fecha_vencimiento', type: 'date', nullable: true })
  fechaVencimiento: string | null;

  // Tarifa 0% de IVA (ej. alimentos en estado natural, medicinas — ver
  // art. 55 LRTI). false = tarifa general vigente (15% al momento de
  // escribir esto). precioVentaCentavos ya incluye el IVA cuando aplica;
  // este campo solo indica si corresponde extraerlo o no al vender.
  @Column({ name: 'iva_exento', default: false })
  ivaExento: boolean;

  @Column({ default: true })
  activo: boolean;

  // Solo se carga cuando hace falta (listado, alertas).
  @OneToMany(() => Lote, (lote) => lote.producto)
  lotes?: Lote[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
