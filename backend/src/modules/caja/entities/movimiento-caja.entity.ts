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
import { TurnoCaja } from './turno-caja.entity';

export enum TipoMovimientoCaja {
  // Sale efectivo del cajón sin ser una venta: pagarle a un proveedor,
  // llevar plata al banco, devolver una venta de un turno ya cerrado.
  RETIRO = 'retiro',
  // Entra efectivo sin ser una venta: traer más cambio.
  INGRESO = 'ingreso',
}

/** Efectivo que entra o sale del cajón durante un turno, fuera de las ventas. */
@Entity('movimientos_caja')
@Index('IDX_movimientos_caja_turno', ['turnoId'])
export class MovimientoCaja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'turno_id' })
  turnoId: string;

  @ManyToOne(() => TurnoCaja, (turno) => turno.movimientos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'turno_id' })
  turno: TurnoCaja;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: TipoMovimientoCaja })
  tipo: TipoMovimientoCaja;

  @Column({ name: 'monto_centavos', type: 'integer' })
  montoCentavos: number;

  @Column({ type: 'varchar', length: 200 })
  motivo: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
