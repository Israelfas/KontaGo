import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { MovimientoCaja } from './movimiento-caja.entity';

/**
 * Un turno de caja de un cajero: lo abre con el fondo inicial (el cambio
 * que hay en el cajón), vende, y al cerrarlo cuenta el efectivo. Cada
 * cajero tiene su propio turno, así una diferencia tiene dueño.
 *
 * Efectivo esperado = fondo inicial + ventas en efectivo (menos lo
 * anulado) + ingresos − retiros. Se calcula y se congela al cerrar (ver
 * CajaService).
 */
@Entity('turnos_caja')
// Un solo turno abierto por usuario (índice parcial en la migración).
@Index('IDX_turnos_caja_abierto_por_usuario', ['usuarioId'], {
  unique: true,
  where: '"cerrado_en" IS NULL',
})
@Index('IDX_turnos_caja_tenant_apertura', ['tenantId', 'abiertoEn'])
export class TurnoCaja {
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

  @Column({ name: 'fondo_inicial_centavos', type: 'integer' })
  fondoInicialCentavos: number;

  @Column({
    name: 'abierto_en',
    type: 'timestamptz',
    default: () => 'now()',
  })
  abiertoEn: Date;

  @Column({ name: 'cerrado_en', type: 'timestamptz', nullable: true })
  cerradoEn: Date | null;

  // Quién lo cerró: el mismo cajero, o el admin si el cajero se fue sin
  // cerrar.
  @Column({ name: 'cerrado_por_id', type: 'uuid', nullable: true })
  cerradoPorId: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cerrado_por_id' })
  cerradoPor: Usuario | null;

  // Congelados al cerrar: lo que el sistema dice que tiene que haber y lo
  // que se contó. La diferencia es contado − esperado (negativa = falta).
  @Column({
    name: 'efectivo_esperado_centavos',
    type: 'integer',
    nullable: true,
  })
  efectivoEsperadoCentavos: number | null;

  @Column({
    name: 'efectivo_contado_centavos',
    type: 'integer',
    nullable: true,
  })
  efectivoContadoCentavos: number | null;

  // Lo que quiera aclarar quien cierra ("faltan $2, se dio mal un vuelto").
  @Column({ type: 'varchar', length: 300, nullable: true })
  nota: string | null;

  @OneToMany(() => MovimientoCaja, (movimiento) => movimiento.turno)
  movimientos: MovimientoCaja[];
}
