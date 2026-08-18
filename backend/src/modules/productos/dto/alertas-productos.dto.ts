import { Producto } from '../entities/producto.entity';

export class AlertasProductosDto {
  stockBajo: Producto[];
  porVencer: Producto[];
}
