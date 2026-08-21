import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { ProductosModule } from '../productos/productos.module';
import { MailModule } from '../mail/mail.module';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Usuario]),
    ProductosModule,
    MailModule,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
