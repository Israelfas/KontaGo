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
import { AnulacionVenta } from './anulacion-venta.entity';
import { TurnoCaja } from '../../caja/entities/turno-caja.entity';
import { MetodoPago } from '../../../common/enums/metodo-pago.enum';

/**
 * Cabecera de una venta (ticket).
 * Los montos se guardan en centavos. La ganancia real (margen) se calcula
 * a partir de los VentaItem, que congelan precioVenta y costoUnitario al
 * momento de la venta (para no depender de que el producto cambie después).
 */
@Entity('ventas')
@Index(['tenantId', 'createdAt'])
@Index('IDX_ventas_tenant_numero', ['tenantId', 'numero'], { unique: true })
@Index('IDX_ventas_tenant_clave', ['tenantId', 'claveIdempotencia'], {
  unique: true,
  where: '"clave_idempotencia" IS NOT NULL',
})
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

  // Número de ticket: 1, 2, 3… por tienda, sin saltos.
  @Column({ type: 'integer' })
  numero: number;

  @Column({ name: 'total_centavos', type: 'integer' })
  totalCentavos: number;

  // Efectivo: lo que dio el cliente. Transferencia: igual al total.
  @Column({ name: 'monto_recibido_centavos', type: 'integer' })
  montoRecibidoCentavos: number;

  @Column({ name: 'vuelto_centavos', type: 'integer' })
  vueltoCentavos: number;

  // Plata devuelta por anulaciones (total o parciales), acumulada. El
  // ingreso real de la venta es totalCentavos - totalAnuladoCentavos.
  @Column({ name: 'total_anulado_centavos', type: 'integer', default: 0 })
  totalAnuladoCentavos: number;

  // Solo el efectivo entra al cajón y al arqueo.
  @Column({
    name: 'metodo_pago',
    type: 'enum',
    enum: MetodoPago,
    default: MetodoPago.EFECTIVO,
  })
  metodoPago: MetodoPago;

  // Turno de caja en el que se cobró (null en ventas de antes del arqueo).
  @Column({ name: 'turno_id', type: 'uuid', nullable: true })
  turnoId: string | null;

  @ManyToOne(() => TurnoCaja, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'turno_id' })
  turno: TurnoCaja | null;

  @OneToMany(() => VentaItem, (item) => item.venta, { cascade: true })
  items: VentaItem[];

  @OneToMany(() => AnulacionVenta, (anulacion) => anulacion.venta)
  anulaciones: AnulacionVenta[];

  // La genera el celular: si la misma venta llega dos veces (se mandó sin
  // conexión, o se cortó la respuesta), la segunda no cobra de nuevo.
  @Column({ name: 'clave_idempotencia', type: 'uuid', nullable: true })
  claveIdempotencia: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
