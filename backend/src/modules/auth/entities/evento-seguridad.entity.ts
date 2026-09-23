import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TipoEventoSeguridad =
  | 'ingreso'
  | 'ingreso_fallido'
  | 'ingreso_bloqueado'
  | 'cuenta_bloqueada'
  | 'ingreso_google'
  | 'cuenta_creada'
  | 'cierre_sesion'
  | 'sesion_revocada_por_reuso'
  | 'recuperacion_pedida'
  | 'password_restablecida'
  | 'password_cambiada_por_admin'
  | 'usuario_desactivado'
  | 'usuario_reactivado';

/**
 * Registro de eventos de seguridad (ISO/IEC 27002:2022, control 8.15):
 * quién entró, quién falló, qué cuenta se bloqueó, quién pidió o cambió
 * una contraseña; con fecha, IP y dispositivo. Sirve para investigar un
 * incidente ("¿alguien entró a mi cuenta?").
 *
 * Nunca se guardan contraseñas ni tokens. `usuarioId`/`tenantId` quedan
 * vacíos cuando el email no corresponde a ninguna cuenta.
 */
@Entity('eventos_seguridad')
@Index('IDX_eventos_seguridad_tenant', ['tenantId', 'createdAt'])
@Index('IDX_eventos_seguridad_usuario', ['usuarioId'])
export class EventoSeguridad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoEventoSeguridad;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 200, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
