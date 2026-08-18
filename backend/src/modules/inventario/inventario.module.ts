import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Producto } from '../productos/entities/producto.entity';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [TypeOrmModule.forFeature([MovimientoInventario, Producto])],
  controllers: [InventarioController],
  providers: [InventarioService],
})
export class InventarioModule {}
