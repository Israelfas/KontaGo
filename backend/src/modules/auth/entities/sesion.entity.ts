import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

/**
 * Una sesión = un inicio de sesión en un dispositivo. Hasta ahora el
 * refreshToken era un JWT que nadie guardaba: servía 7 días pase lo que
 * pase (aunque la persona cerrara sesión o se lo robaran). Con la sesión
 * guardada se puede cortar.
 *
 * - Los dos tokens llevan el id de la sesión (sid). El accessToken deja
 *   de servir en cuanto la sesión se revoca (lo chequea JwtStrategy).
 * - Cada renovación cambia el refreshToken (rotación): la sesión guarda
 *   el jti del vigente. Si llega uno viejo, alguien lo copió → se
 *   revoca la sesión entera (ver AuthService.refrescar).
 */
@Entity('sesiones')
@Index('IDX_sesiones_usuario', ['usuarioId'])
export class Sesion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  // jti del refreshToken vigente.
  @Column({ name: 'jti_actual', type: 'uuid' })
  jtiActual: string;

  // El anterior, aceptado unos segundos después de rotar (dos pestañas
  // que renuevan a la vez con el mismo token).
  @Column({ name: 'jti_anterior', type: 'uuid', nullable: true })
  jtiAnterior: string | null;

  @Column({ name: 'rotada_en', type: 'timestamptz', nullable: true })
  rotadaEn: Date | null;

  // Se corre con cada renovación: una sesión que se usa no vence.
  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn: Date;

  @Column({ name: 'revocada_en', type: 'timestamptz', nullable: true })
  revocadaEn: Date | null;

  // 'cierre' | 'reuso' | 'usuario_desactivado' | 'password_cambiada'
  @Column({
    name: 'motivo_revocacion',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  motivoRevocacion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
