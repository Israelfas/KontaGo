import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { AbonoFiado } from './entities/abono-fiado.entity';
import { FiadosController } from './fiados.controller';
import { FiadosService } from './fiados.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, AbonoFiado])],
  controllers: [FiadosController],
  providers: [FiadosService],
})
export class FiadosModule {}
