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
import { Rol } from '../../../common/enums/rol.enum';

@Entity('usuarios')
@Index(['tenantId', 'email'], { unique: true })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 150 })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: Rol, default: Rol.CAJERO })
  rol: Rol;

  @Column({ default: true })
  activo: boolean;

  // Intentos de ingreso con contraseña equivocada seguidos. Al llegar al
  // límite la cuenta se bloquea unos minutos (ver AuthService.login).
  @Column({ name: 'intentos_fallidos', type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  // Cuándo aceptó los términos y la política de privacidad (LOPDP).
  @Column({
    name: 'terminos_aceptados_en',
    type: 'timestamptz',
    nullable: true,
  })
  terminosAceptadosEn: Date | null;

  // --- Verificación en dos pasos (ver auth/dos-pasos.service.ts) ---
  // Los datos sensibles no se leen salvo que se pidan (select: false): así
  // no se filtran por accidente en ninguna respuesta.

  // null = no la usa. Con fecha, el login pide además el código.
  @Column({
    name: 'dos_pasos_activo_desde',
    type: 'timestamptz',
    nullable: true,
  })
  dosPasosActivoDesde: Date | null;

  // El secreto de la app autenticadora, cifrado.
  @Column({
    name: 'dos_pasos_secreto',
    type: 'text',
    nullable: true,
    select: false,
  })
  dosPasosSecreto?: string | null;

  // El que se está configurando, hasta que se confirma con un código.
  @Column({
    name: 'dos_pasos_pendiente',
    type: 'text',
    nullable: true,
    select: false,
  })
  dosPasosPendiente?: string | null;

  // El paso (de 30 s) del último código aceptado: no se acepta dos veces.
  @Column({
    name: 'dos_pasos_ultimo_paso',
    type: 'integer',
    nullable: true,
    select: false,
  })
  dosPasosUltimoPaso?: number | null;

  // Códigos de recuperación sin usar: solo su hash.
  @Column({
    name: 'dos_pasos_codigos',
    type: 'jsonb',
    nullable: true,
    select: false,
  })
  dosPasosCodigos?: string[] | null;

  // La cuenta de Google (Clerk) vinculada. Una vez vinculada, entra por
  // este ID y no por el correo (que puede cambiar o reutilizarse).
  @Column({
    name: 'clerk_user_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  clerkUserId: string | null;

  // Cuándo se demostró que el correo es de quien usa la cuenta: al
  // crearla con Google o al usar un enlace de recuperación. Sin esto no se
  // vincula Google por correo: cualquiera podría registrar el correo de
  // otra persona y esperar a que entre con Google a una tienda ajena.
  @Column({
    name: 'email_verificado_en',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificadoEn: Date | null;

  // Cada vez que se cortan todas sus sesiones (cambio de contraseña,
  // desactivación, "cerrar en todos lados") se anota el momento. Un
  // ingreso cuya contraseña (o código) se verificó antes ya no puede crear
  // una sesión: si no, un ingreso en curso o un desafío de dos pasos
  // emitido antes sobrevivía al cambio.
  @Column({
    name: 'sesiones_validas_desde',
    type: 'timestamptz',
    nullable: true,
  })
  sesionesValidasDesde: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
