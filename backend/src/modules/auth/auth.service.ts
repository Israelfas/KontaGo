import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Rol } from '../../common/enums/rol.enum';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegistroDto } from './dto/registro.dto';

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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Alta de un dueño de tienda nuevo: crea el Tenant y su Usuario admin en
   * una sola transacción (si algo falla, no queda una tienda sin dueño ni
   * un usuario huérfano). Devuelve tokens de sesión, para loguear
   * automáticamente después de registrarse.
   *
   * Nota sobre unicidad de email: el índice de la entidad Usuario es
   * (tenantId, email), lo que en teoría permitiría el mismo email en dos
   * tenants distintos. Pero el login actual busca solo por email (sin
   * tenantId, porque el usuario todavía no tiene sesión para saber a qué
   * tenant pertenece), así que en la práctica el email debe ser único en
   * toda la plataforma. Por eso acá se valida global, no por tenant.
   */
  async registrar(dto: RegistroDto): Promise<TokenPair> {
    const emailExistente = await this.usuarioRepo.findOne({
      where: { email: dto.email },
    });

    if (emailExistente) {
      throw new ConflictException('Ese email ya está registrado');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const usuario = await this.dataSource.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const usuarioRepo = manager.getRepository(Usuario);

      const tenant = tenantRepo.create({
        nombre: dto.nombreTienda,
        moneda: dto.moneda ?? 'USD',
      });
      await tenantRepo.save(tenant);

      const nuevoUsuario = usuarioRepo.create({
        tenantId: tenant.id,
        nombre: dto.nombreAdmin,
        email: dto.email,
        passwordHash,
        rol: Rol.ADMIN,
      });
      return usuarioRepo.save(nuevoUsuario);
    });

    return this.emitirTokens(usuario);
  }

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