import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Producto } from '../../productos/entities/producto.entity';

/**
 * Un lote: unidades de un producto que vencen el mismo día. Llega la
 * leche del lunes (vence el 28) y la del jueves (vence el 5): son dos
 * lotes del mismo producto.
 *
 * Reglas (ver inventario/lotes.ts):
 * - Si un producto tiene lotes, la suma de sus `cantidad` es SIEMPRE
 *   igual a producto.stock. Un producto que nunca tuvo fecha (arroz,
 *   jabón) no tiene lotes y se maneja solo con stock.
 * - Las ventas y mermas descuentan primero del que vence antes (FEFO);
 *   los "sin fecha" (fechaVencimiento null) van al final.
 * - Un lote agotado no se borra (cantidad 0): las ventas pasadas lo
 *   referencian para devolver unidades si se anulan.
 */
@Entity('lotes')
@Index('IDX_lotes_producto', ['productoId'])
export class Lote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'producto_id' })
  productoId: string;

  @ManyToOne(() => Producto, (producto) => producto.lotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  // 'AAAA-MM-DD' como texto (fecha de calendario, igual que en Producto).
  // null = unidades sin fecha conocida (ej. el stock que había antes de
  // empezar a cargar lotes).
  @Column({ name: 'fecha_vencimiento', type: 'date', nullable: true })
  fechaVencimiento: string | null;

  // Lo que queda del lote.
  @Column({ type: 'integer' })
  cantidad: number;

  // Lo que entró (para mostrar "quedan 4 de 12").
  @Column({ name: 'cantidad_inicial', type: 'integer' })
  cantidadInicial: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
