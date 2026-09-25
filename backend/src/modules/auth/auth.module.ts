import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { Sesion } from './entities/sesion.entity';
import { RecuperacionPassword } from './entities/recuperacion-password.entity';
import { EventoSeguridad } from './entities/evento-seguridad.entity';
import { SeguridadService } from './seguridad.service';
import { DosPasosService } from './dos-pasos.service';
import { MailModule } from '../mail/mail.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Tenant,
      Sesion,
      RecuperacionPassword,
      EventoSeguridad,
    ]),
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: config.get<number>('jwt.accessExpiresInSeconds'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SeguridadService, DosPasosService],
  exports: [AuthService, SeguridadService, DosPasosService],
})
export class AuthModule {}
