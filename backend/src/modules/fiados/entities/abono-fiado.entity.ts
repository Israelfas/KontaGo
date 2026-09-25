import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Cliente } from './cliente.entity';

/** Cómo pagó el abono: el fiado se paga en efectivo o por transferencia. */
export enum MetodoDeAbono {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
}

/**
 * Un pago de lo que el cliente debe. En efectivo entra al cajón de quien
 * lo recibe (como un ingreso de su caja, así el arqueo cuadra).
 */
@Entity('abonos_fiado')
@Index('IDX_abonos_fiado_cliente', ['clienteId'])
export class AbonoFiado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'cliente_id' })
  clienteId: string;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'monto_centavos', type: 'integer' })
  montoCentavos: number;

  @Column({ name: 'metodo_pago', type: 'enum', enum: MetodoDeAbono })
  metodoPago: MetodoDeAbono;

  // En efectivo: el turno de caja al que entró.
  @Column({ name: 'turno_id', type: 'uuid', nullable: true })
  turnoId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nota: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
