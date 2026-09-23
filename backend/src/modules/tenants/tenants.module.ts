import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TiendaController } from './tienda.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [TiendaController],
  exports: [TypeOrmModule],
})
export class TenantsModule {}
