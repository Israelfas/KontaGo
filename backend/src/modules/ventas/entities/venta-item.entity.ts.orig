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

  // Porción de IVA contenida en (precioVentaCentavos * cantidad), ya
  // extraída del precio final (que incluye IVA). 0 si el producto estaba
  // marcado como exento al momento de la venta. Congelado igual que el
  // precio: si la tarifa general cambia después por decreto, los tickets
  // históricos no deben recalcularse.
  @Column({ name: 'iva_centavos', type: 'integer', default: 0 })
  ivaCentavos: number;
}
