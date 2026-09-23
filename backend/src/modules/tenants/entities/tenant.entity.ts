import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanTenant } from '../../../common/enums/plan-tenant.enum';

/**
 * Tenant = una tienda dentro de KontaGo.
 * Todo dato de negocio (productos, ventas, movimientos) cuelga de un tenant_id.
 * Esta es la decisión de la Fase 1 que evita migraciones dolorosas después (ver sección 8 del spec).
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  // Moneda por tienda. MVP: una sola moneda por tenant (ver sección 6.3 del spec).
  @Column({ length: 3, default: 'USD' })
  moneda: string;

  // Plan de suscripción del tenant (sección 6.4 del spec). Se define en el
  // modelo desde la Fase 1 para no migrar la tabla después, aunque la
  // VALIDACIÓN de este campo en los endpoints de funciones avanzadas
  // (estadísticas históricas, OCR, multi-sucursal) recién se implementa
  // en la Fase 3, cuando esas funciones existan. Nunca confiar solo en el
  // frontend para esto: cada endpoint pago debe chequear este campo server-side.
  @Column({ type: 'enum', enum: PlanTenant, default: PlanTenant.GRATUITO })
  plan: PlanTenant;

  @Column({ default: true })
  activo: boolean;

  // Datos para el ticket (y la futura factura electrónica). Opcionales:
  // una tienda recién creada solo tiene el nombre.
  @Column({
    name: 'razon_social',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  ruc: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({
    name: 'mensaje_ticket',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  mensajeTicket: string | null;

  // Último número de ticket entregado (ver ventas.numero). Lo incrementa
  // la venta, dentro de su transacción.
  @Column({ name: 'ultimo_numero_venta', type: 'integer', default: 0 })
  ultimoNumeroVenta: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
