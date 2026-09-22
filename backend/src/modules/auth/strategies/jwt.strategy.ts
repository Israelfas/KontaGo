import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
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
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.usuarioRepo.findOne({
      select: { id: true, tenantId: true, rol: true },
      where: { id: payload.sub, tenantId: payload.tenantId, activo: true },
    });
    if (!usuario) {
      throw new UnauthorizedException('Tu usuario fue desactivado');
    }

    return {
      usuarioId: usuario.id,
      tenantId: usuario.tenantId,
      rol: usuario.rol,
    };
  }
}
