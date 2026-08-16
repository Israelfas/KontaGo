import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { VentaItem } from './venta-item.entity';

/**
 * Cabecera de una venta (ticket).
 * Los montos se guardan en centavos. La ganancia real (margen) se calcula
 * a partir de los VentaItem, que congelan precioVenta y costoUnitario al
 * momento de la venta (para no depender de que el producto cambie después).
 */
@Entity('ventas')
@Index(['tenantId', 'createdAt'])
export class Venta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'total_centavos', type: 'integer' })
  totalCentavos: number;

  @Column({ name: 'monto_recibido_centavos', type: 'integer' })
  montoRecibidoCentavos: number;

  @Column({ name: 'vuelto_centavos', type: 'integer' })
  vueltoCentavos: number;

  @OneToMany(() => VentaItem, (item) => item.venta, { cascade: true })
  items: VentaItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
