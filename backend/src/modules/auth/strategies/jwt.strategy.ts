import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Sesion } from '../entities/sesion.entity';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  // El valor de retorno se inyecta automáticamente en request.user.
  //
  // Además de la firma, se verifica contra la base que el usuario siga
  // activo: si el admin desactiva a un cajero, pierde el acceso en ese
  // momento y no recién cuando vence su token (hasta 15 min después).
  // El rol también sale de la base, por si cambió desde que se emitió el
  // token. Es una búsqueda por clave primaria por request: barata.
  //
  // Lo mismo con la sesión: al cerrar sesión (o si se detecta un token
  // robado) el accessToken deja de servir en el acto, no 15 min después.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sid) {
      throw new UnauthorizedException('Sesión vencida, iniciá sesión de nuevo');
    }
    const [usuario, sesionViva] = await Promise.all([
      this.usuarioRepo.findOne({
        select: { id: true, tenantId: true, rol: true },
        where: { id: payload.sub, tenantId: payload.tenantId, activo: true },
      }),
      this.sesionRepo.exists({
        where: {
          id: payload.sid,
          usuarioId: payload.sub,
          revocadaEn: IsNull(),
          expiraEn: MoreThan(new Date()),
        },
      }),
    ]);
    if (!usuario) {
      throw new UnauthorizedException('Tu usuario fue desactivado');
    }
    if (!sesionViva) {
      throw new UnauthorizedException('Sesión cerrada, iniciá sesión de nuevo');
    }

    return {
      usuarioId: usuario.id,
      tenantId: usuario.tenantId,
      rol: usuario.rol,
    };
  }
}
