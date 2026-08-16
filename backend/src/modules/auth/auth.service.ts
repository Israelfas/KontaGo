import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type { TokenPair };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const usuario = await this.usuarioRepo.findOne({
      where: { email, activo: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.emitirTokens(usuario);
  }

  private emitirTokens(usuario: Usuario): TokenPair {
    const payload: JwtPayload = {
      sub: usuario.id,
      tenantId: usuario.tenantId,
      rol: usuario.rol,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<number>('jwt.accessExpiresInSeconds'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<number>('jwt.refreshExpiresInSeconds'),
    });

    return { accessToken, refreshToken };
  }

  async hashPassword(password: string): Promise<string> {
    const SALT_ROUNDS = 10;
    return bcrypt.hash(password, SALT_ROUNDS);
  }
}
