import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VentaItem } from './venta-item.entity';
import { Lote } from '../../inventario/entities/lote.entity';

/**
 * De qué lote salieron las unidades de una línea de venta. Una línea
 * puede tocar varios lotes (se vendieron 5 y el más próximo a vencer
 * tenía 3). Sirve para que una anulación devuelva cada unidad al lote del
 * que salió, y no al que vence más tarde.
 */
@Entity('venta_item_lotes')
@Index('IDX_venta_item_lotes_item', ['ventaItemId'])
export class VentaItemLote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'venta_item_id' })
  ventaItemId: string;

  @ManyToOne(() => VentaItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venta_item_id' })
  ventaItem: VentaItem;

  @Column({ name: 'lote_id' })
  loteId: string;

  @ManyToOne(() => Lote, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lote_id' })
  lote: Lote;

  @Column({ type: 'integer' })
  cantidad: number;

  // Cuántas de estas unidades volvieron al lote por anulaciones.
  @Column({ name: 'cantidad_devuelta', type: 'integer', default: 0 })
  cantidadDevuelta: number;
}
