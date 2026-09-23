import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductosModule } from './modules/productos/productos.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { CajaModule } from './modules/caja/caja.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    // Límite de pedidos por IP. No es global: solo lo aplican los
    // controllers que usan ThrottlerGuard (hoy, auth), para no frenar el
    // escaneo en caja. En memoria alcanza mientras haya una sola
    // instancia del backend.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      // En español: este texto le llega a la persona en el login.
      errorMessage:
        'Demasiados intentos seguidos desde esta conexión. Esperá un minuto y probá de nuevo.',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        // synchronize SIEMPRE false salvo que se fuerce explícitamente por
        // env var en desarrollo local. En producción el esquema se maneja
        // con migraciones (ver database/migrations).
        synchronize: config.get<boolean>('database.synchronize'),
        autoLoadEntities: true,
      }),
    }),
    TenantsModule,
    AuthModule,
    ProductosModule,
    VentasModule,
    InventarioModule,
    NotificacionesModule,
    UsuariosModule,
    CajaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
