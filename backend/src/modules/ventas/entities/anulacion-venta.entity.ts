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
import { Usuario } from '../../auth/entities/usuario.entity';
import { Venta } from './venta.entity';

export interface DetalleAnulacion {
  ventaItemId: string;
  productoId: string;
  cantidad: number;
}

/**
 * Registro de auditoría de cada anulación: quién anuló qué, cuándo y por
 * qué. Los números que usan los reportes viven en VentaItem.cantidadAnulada
 * y Venta.totalAnuladoCentavos; esto es el historial de cómo se llegó ahí.
 */
@Entity('anulaciones_venta')
@Index('IDX_anulaciones_venta_venta', ['ventaId'])
export class AnulacionVenta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'venta_id' })
  ventaId: string;

  @ManyToOne(() => Venta, (venta) => venta.anulaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_id' })
  venta: Venta;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ length: 300 })
  motivo: string;

  // Precio final (con IVA) de las unidades anuladas: lo que se le
  // devuelve al cliente.
  @Column({ name: 'monto_devuelto_centavos', type: 'integer' })
  montoDevueltoCentavos: number;

  @Column({ type: 'jsonb' })
  detalle: DetalleAnulacion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
