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
 * Alguien a quien la tienda le fía: el vecino de siempre. El saldo no se
 * guarda acá: sale de sus ventas al fiado (menos lo anulado) y sus abonos,
 * así nunca queda desfasado.
 */
@Entity('clientes')
@Index('IDX_clientes_tenant', ['tenantId'])
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 120 })
  nombre: string;

  // Para mandarle un WhatsApp con lo que debe.
  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  // Archivado (ya no se le fía): no aparece al vender. Solo con saldo 0.
  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
