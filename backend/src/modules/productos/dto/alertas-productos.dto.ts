import { Producto } from '../entities/producto.entity';

export class AlertasProductosDto {
  stockBajo: Producto[];
  // Tienen al menos un lote con unidades que vence en los próximos días.
  porVencer: Producto[];
  // Tienen al menos un lote con unidades ya vencido: hay que darlo de baja.
  vencidos: Producto[];
}
