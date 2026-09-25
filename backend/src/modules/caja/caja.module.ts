import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TurnoCaja } from './entities/turno-caja.entity';
import { MovimientoCaja } from './entities/movimiento-caja.entity';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurnoCaja, MovimientoCaja])],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
