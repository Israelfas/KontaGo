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
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { Sesion } from './entities/sesion.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Rol } from '../../common/enums/rol.enum';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegistroDto } from './dto/registro.dto';
import { bloquearEmail } from '../../common/db/bloquear-email';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type { TokenPair };

// Si dos pestañas (o dos pedidos) renuevan casi a la vez con el mismo
// refreshToken, la segunda llega con uno recién rotado. Dentro de esta
// ventana se acepta; después, un token viejo es señal de que lo copiaron.
const VENTANA_REUSO_MS = 60_000;

const SESION_VENCIDA = 'Sesión vencida, iniciá sesión de nuevo';

export type MotivoRevocacion =
  'cierre' | 'reuso' | 'usuario_desactivado' | 'password_cambiada';

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
      await bloquearEmail(manager, dto.email);
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
        await bloquearEmail(manager, email);
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
   * Canjea un refreshToken por un par nuevo (rotación: el refreshToken
   * usado deja de servir). Se relee el usuario de la base en vez de
   * copiar el payload viejo: si lo desactivaron o le cambiaron el rol,
   * el cambio se aplica en la próxima renovación.
   *
   * Si llega un refreshToken que ya se rotó (fuera de la ventana de unos
   * segundos para pedidos simultáneos), alguien más lo tiene: se revoca
   * la sesión entera, así el que lo robó y el dueño quedan afuera, y el
   * dueño vuelve a entrar con su contraseña.
   */
  async refrescar(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verificarRefresh(refreshToken);
    if (!payload?.sid || !payload.jti) {
      throw new UnauthorizedException(SESION_VENCIDA);
    }
    const { sid, jti } = payload;

    // Con 'reuso' la sesión se revoca y se confirma (hay que guardarlo
    // aunque la respuesta sea un error), por eso el error sale después
    // de la transacción.
    let revocadaPorReuso = false;
    const tokens = await this.dataSource.transaction(async (manager) => {
      const sesionRepo = manager.getRepository(Sesion);
      // Bloqueo: dos renovaciones simultáneas de la misma sesión se
      // ordenan en vez de rotar las dos a partir del mismo estado.
      const sesion = await sesionRepo.findOne({
        where: { id: sid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sesion || sesion.revocadaEn || sesion.expiraEn <= new Date()) {
        return null;
      }

      const esElActual = jti === sesion.jtiActual;
      const recienRotado =
        jti === sesion.jtiAnterior &&
        sesion.rotadaEn !== null &&
        Date.now() - sesion.rotadaEn.getTime() < VENTANA_REUSO_MS;
      if (!esElActual && !recienRotado) {
        sesion.revocadaEn = new Date();
        sesion.motivoRevocacion = 'reuso';
        await sesionRepo.save(sesion);
        revocadaPorReuso = true;
        return null;
      }

      const usuario = await manager.getRepository(Usuario).findOne({
        where: {
          id: sesion.usuarioId,
          tenantId: sesion.tenantId,
          activo: true,
        },
      });
      if (!usuario) return null;

      if (esElActual) {
        sesion.jtiAnterior = sesion.jtiActual;
        sesion.jtiActual = randomUUID();
        sesion.rotadaEn = new Date();
      }
      // Recién rotado: se entrega el refreshToken vigente (mismo jti que
      // recibió el otro pedido), así no quedan dos cadenas.
      sesion.expiraEn = this.vencimientoDeSesion();
      await sesionRepo.save(sesion);
      return this.firmarTokens(usuario, sesion);
    });

    if (!tokens) {
      throw new UnauthorizedException(
        revocadaPorReuso
          ? 'Por seguridad cerramos tu sesión: iniciá sesión de nuevo'
          : SESION_VENCIDA,
      );
    }
    return tokens;
  }

  /**
   * Cierra la sesión del refreshToken (botón "Salir"). No falla nunca: si
   * el token ya no sirve, la sesión ya estaba cerrada. Se acepta un token
   * vencido: cerrar sesión tiene que funcionar igual.
   */
  async cerrarSesion(refreshToken: string): Promise<void> {
    const payload = await this.verificarRefresh(refreshToken, true);
    if (!payload?.sid) return;
    await this.dataSource
      .getRepository(Sesion)
      .update(
        { id: payload.sid, revocadaEn: IsNull() },
        { revocadaEn: new Date(), motivoRevocacion: 'cierre' },
      );
  }

  /**
   * Corta todas las sesiones de un usuario (lo desactivaron, le cambiaron
   * la contraseña). Sus tokens dejan de servir en el próximo pedido.
   */
  async revocarSesionesDe(
    usuarioId: string,
    motivo: MotivoRevocacion,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    await manager
      .getRepository(Sesion)
      .update(
        { usuarioId, revocadaEn: IsNull() },
        { revocadaEn: new Date(), motivoRevocacion: motivo },
      );
  }

  private async verificarRefresh(
    token: string,
    ignorarVencimiento = false,
  ): Promise<JwtPayload | null> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        ignoreExpiration: ignorarVencimiento,
      });
    } catch {
      return null;
    }
  }

  private vencimientoDeSesion(): Date {
    const segundos = this.configService.get<number>(
      'jwt.refreshExpiresInSeconds',
    )!;
    return new Date(Date.now() + segundos * 1000);
  }

  /** Inicio de sesión: una sesión nueva y su primer par de tokens. */
  private async emitirTokens(usuario: Usuario): Promise<TokenPair> {
    const sesionRepo = this.dataSource.getRepository(Sesion);
    const sesion = await sesionRepo.save(
      sesionRepo.create({
        usuarioId: usuario.id,
        tenantId: usuario.tenantId,
        jtiActual: randomUUID(),
        expiraEn: this.vencimientoDeSesion(),
      }),
    );
    return this.firmarTokens(usuario, sesion);
  }

  private firmarTokens(usuario: Usuario, sesion: Sesion): TokenPair {
    const payload: JwtPayload = {
      sub: usuario.id,
      tenantId: usuario.tenantId,
      rol: usuario.rol,
      sid: sesion.id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<number>('jwt.accessExpiresInSeconds'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<number>('jwt.refreshExpiresInSeconds'),
      jwtid: sesion.jtiActual,
    });

    return { accessToken, refreshToken };
  }

  async hashPassword(password: string): Promise<string> {
    const SALT_ROUNDS = 10;
    return bcrypt.hash(password, SALT_ROUNDS);
  }
}
