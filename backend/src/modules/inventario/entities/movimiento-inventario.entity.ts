import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Producto } from '../../productos/entities/producto.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { TipoMovimientoInventario } from '../../../common/enums/tipo-movimiento-inventario.enum';
import { MotivoMerma } from '../../../common/enums/motivo-merma.enum';

/**
 * Un movimiento de inventario es un abastecimiento (entra mercadería) o
 * una merma (sale mercadería sin venderse: vencido, dañado, robado).
 *
 * Por qué una sola tabla para los dos (sección 3.3 del spec):
 * - Ambos afectan el mismo campo (stock del producto).
 * - Ambos necesitan quedar en el historial con quién y cuándo.
 * - El reporte del día necesita sumar "egreso de caja" (abastecimientos)
 *   y "pérdidas" (mermas) por separado, pero ambos son "movimientos de
 *   stock que no son ventas" — separarlos en dos tablas hubiera duplicado
 *   toda la lógica de bloqueo/transacción sin beneficio real.
 *
 * costoUnitarioCentavos tiene significado distinto según el tipo:
 * - ABASTECIMIENTO: el costo de compra de esa entrada (se usa para
 *   recalcular el costo promedio ponderado del producto).
 * - MERMA: el costo unitario del producto en el momento de la pérdida
 *   (se usa para valorizar cuánto se perdió, a valor de costo).
 */
@Entity('movimientos_inventario')
@Index(['tenantId', 'createdAt'])
export class MovimientoInventario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'producto_id' })
  productoId: string;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: TipoMovimientoInventario })
  tipo: TipoMovimientoInventario;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ name: 'costo_unitario_centavos', type: 'integer' })
  costoUnitarioCentavos: number;

  // Solo tiene sentido en ABASTECIMIENTO.
  @Column({ type: 'varchar', length: 150, nullable: true })
  proveedor: string | null;

  // Solo tiene sentido en MERMA.
  @Column({ type: 'enum', enum: MotivoMerma, nullable: true })
  motivo: MotivoMerma | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
