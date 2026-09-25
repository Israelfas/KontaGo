import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { VentasModule } from '../ventas/ventas.module';
import { InventarioModule } from '../inventario/inventario.module';
import { CajaModule } from '../caja/caja.module';
import { ProductosModule } from '../productos/productos.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    VentasModule,
    InventarioModule,
    CajaModule,
    ProductosModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
