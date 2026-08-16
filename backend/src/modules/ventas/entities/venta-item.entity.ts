import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Venta } from './venta.entity';
import { Producto } from '../../productos/entities/producto.entity';

@Entity('venta_items')
export class VentaItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'venta_id' })
  ventaId: string;

  @ManyToOne(() => Venta, (venta) => venta.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_id' })
  venta: Venta;

  @Column({ name: 'producto_id' })
  productoId: string;

  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ type: 'integer' })
  cantidad: number;

  // Congelados al momento de la venta: si el producto cambia de precio
  // después, el ticket histórico no debe cambiar.
  @Column({ name: 'precio_venta_centavos', type: 'integer' })
  precioVentaCentavos: number;

  @Column({ name: 'costo_unitario_centavos', type: 'integer' })
  costoUnitarioCentavos: number;
}
