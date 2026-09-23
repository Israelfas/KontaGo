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
 * Un pedido de "olvidé mi contraseña". Del enlace que se manda por email
 * se guarda solo su hash (SHA-256): quien lea la base no puede usarlo.
 * Sirve una sola vez y por poco tiempo (ver AuthService).
 */
@Entity('recuperaciones_password')
@Index('IDX_recuperaciones_usuario', ['usuarioId'])
export class RecuperacionPassword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Index('UQ_recuperaciones_token', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn: Date;

  // Usada para cambiar la contraseña, o anulada por un pedido más nuevo.
  @Column({ name: 'usada_en', type: 'timestamptz', nullable: true })
  usadaEn: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
