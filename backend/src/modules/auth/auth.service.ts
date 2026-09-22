import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { verifyToken } from '@clerk/backend';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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

      // El chequeo de arriba es solo para fallar rápido; el que vale es
      // este, ya con el lock tomado (ver bloquearEmail).
      await this.bloquearEmail(manager, dto.email);
      if (await usuarioRepo.exists({ where: { email: dto.email } })) {
        throw new ConflictException('Ese email ya está registrado');
      }

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

  /**
   * Datos de cuenta que no viajan en el JWT (nombre, email, plan de la
   * tienda) — el token solo lleva sub/tenantId/rol para no engordarlo,
   * así que la pantalla de perfil pide esto aparte, bajo demanda.
   */
  async obtenerPerfil(usuarioId: string, tenantId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: usuarioId, tenantId, activo: true },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    return {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      tienda: tenant?.nombre ?? null,
      plan: tenant?.plan ?? null,
    };
  }

  /**
   * Puente con Clerk: Clerk se encarga de verificar "quién sos" (Google,
   * email, lo que sea), pero KontaGo sigue siendo el dueño de "a qué
   * tienda pertenecés y qué rol tenés". Acá se verifica el token que
   * Clerk emitió del lado del cliente, y a partir del email verificado
   * se busca (o crea, si es la primera vez) el Usuario/Tenant de
   * siempre — y se emite el MISMO tipo de JWT que login()/registrar().
   * Así ningún guard ni controller existente se entera de que Clerk
   * existe: para el resto de la app, esto es indistinguible de un login
   * común.
   *
   * Primera vez con Clerk (sin cuenta KontaGo previa) = se le crea una
   * tienda nueva automáticamente, como admin, igual que si se hubiera
   * registrado a mano — el nombre de la tienda queda con un valor por
   * defecto que puede cambiar después (no hay pantalla para eso todavía).
   */
  async loginConClerk(clerkToken: string): Promise<TokenPair> {
    const secretKey = this.configService.get<string>('clerk.secretKey');
    if (!secretKey) {
      throw new UnauthorizedException(
        'El login con Clerk no está configurado en el servidor (falta CLERK_SECRET_KEY)',
      );
    }

    let claims: { sub: string };
    try {
      claims = await verifyToken(clerkToken, { secretKey });
    } catch {
      throw new UnauthorizedException('Token de Clerk inválido o vencido');
    }

    // El JWT de Clerk no trae el email en un campo fijo entre planes/
    // configuraciones — lo más confiable es pedirle el usuario completo
    // a la API de Clerk con el ID verificado (claims.sub).
    const { createClerkClient } = await import('@clerk/backend');
    const clerkClient = createClerkClient({ secretKey });
    const clerkUsuario = await clerkClient.users.getUser(claims.sub);
    const emailPrimario = clerkUsuario.emailAddresses.find(
      (e) => e.id === clerkUsuario.primaryEmailAddressId,
    );
    // Solo un email VERIFICADO por Clerk sirve para vincular cuentas: con
    // uno sin verificar, cualquiera podría crear una cuenta de Clerk con
    // el email de otra persona y entrar a su tienda de KontaGo.
    const email =
      emailPrimario?.verification?.status === 'verified'
        ? emailPrimario.emailAddress.trim().toLowerCase()
        : undefined;

    if (!email) {
      throw new UnauthorizedException(
        'Tu cuenta de Clerk no tiene un email verificado',
      );
    }

    let usuario = await this.usuarioRepo.findOne({
      where: { email, activo: true },
    });

    if (!usuario) {
      const nombre =
        [clerkUsuario.firstName, clerkUsuario.lastName]
          .filter(Boolean)
          .join(' ') || email.split('@')[0];

      usuario = await this.dataSource.transaction(async (manager) => {
        const tenantRepo = manager.getRepository(Tenant);
        const usuarioRepo = manager.getRepository(Usuario);

        // Dos logins simultáneos de la misma persona nueva (doble click,
        // web + móvil) crearían dos tiendas. Con el lock, el segundo
        // espera y encuentra el usuario que creó el primero.
        await this.bloquearEmail(manager, email);
        const yaCreado = await usuarioRepo.findOne({ where: { email } });
        if (yaCreado) {
          if (!yaCreado.activo) {
            throw new UnauthorizedException('Usuario desactivado');
          }
          return yaCreado;
        }

        const tenant = tenantRepo.create({
          nombre: `Tienda de ${nombre}`,
          moneda: 'USD',
        });
        await tenantRepo.save(tenant);

        const nuevoUsuario = usuarioRepo.create({
          tenantId: tenant.id,
          nombre,
          email,
          // Cuenta creada vía Clerk: no tiene contraseña propia en
          // KontaGo. Se guarda un hash de un valor aleatorio (nunca
          // usable para loguearse por /auth/login) en vez de dejar la
          // columna nula, para no tener que volverla opcional en toda
          // la base solo por este caso.
          passwordHash: await this.hashPassword(randomUUID()),
          rol: Rol.ADMIN,
        });
        return usuarioRepo.save(nuevoUsuario);
      });
    }

    return this.emitirTokens(usuario);
  }

  /**
   * Canjea un refreshToken por un par nuevo. Se relee el usuario de la
   * base en vez de copiar el payload viejo: si lo desactivaron o le
   * cambiaron el rol, el cambio se aplica en la próxima renovación.
   */
  async refrescar(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Sesión vencida, iniciá sesión de nuevo');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub, tenantId: payload.tenantId, activo: true },
    });
    if (!usuario) {
      throw new UnauthorizedException('Sesión vencida, iniciá sesión de nuevo');
    }

    return this.emitirTokens(usuario);
  }

  /**
   * Lock de Postgres por email, liberado al terminar la transacción.
   * El índice único de Usuario es (tenantId, email), así que la base no
   * frena por sí sola dos altas con el mismo email en tenants distintos.
   */
  private async bloquearEmail(
    manager: EntityManager,
    email: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
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
