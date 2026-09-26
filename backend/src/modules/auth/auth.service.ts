import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { Sesion } from './entities/sesion.entity';
import { RecuperacionPassword } from './entities/recuperacion-password.entity';
import { SeguridadService, type ContextoPedido } from './seguridad.service';
import { DosPasosService } from './dos-pasos.service';
import type { TipoEventoSeguridad } from './entities/evento-seguridad.entity';
import { MailService } from '../mail/mail.service';
import { correoPasswordCambiada, correoRecuperacion } from './correos';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Rol } from '../../common/enums/rol.enum';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegistroDto } from './dto/registro.dto';
import { bloquearEmail } from '../../common/db/bloquear-email';
import * as bloqueo from './bloqueo-de-cuenta';
import type { MotivoRevocacion } from './bloqueo-de-cuenta';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type { TokenPair };

// Si dos pestañas (o dos pedidos) renuevan casi a la vez con el mismo
// refreshToken, la segunda llega con uno recién rotado. Dentro de esta
// ventana se acepta; después, un token viejo es señal de que lo copiaron.
const VENTANA_REUSO_MS = 60_000;

const SESION_VENCIDA = 'Sesión vencida, inicia sesión de nuevo';

// --- Autenticación segura (ISO/IEC 27002:2022, 5.17 y 8.5) ---

// El mismo mensaje exista o no el email: si no, sirve para averiguar
// qué emails tienen cuenta.
const CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos.';

/** Cuánto dura el paso del código después de la contraseña. */
const SEGUNDOS_PARA_EL_CODIGO = 5 * 60;

/**
 * Contraseña (o Google) bien, pero la cuenta tiene la verificación en dos
 * pasos: falta el código. El desafío es un token corto que solo sirve para
 * /auth/login/codigo.
 */
export interface DesafioDosPasos {
  requiereCodigo: true;
  desafio: string;
}

export type RespuestaIngreso = TokenPair | DesafioDosPasos;

interface PayloadDesafio {
  sub: string;
  tipo: 'dos-pasos';
  metodo: 'password' | 'google';
  // Cuándo se verificó el primer factor (ms). Si después se cortaron las
  // sesiones de la cuenta, el desafío ya no sirve.
  verificadoEn?: number;
  iat?: number;
}

// Enlace de "olvidé mi contraseña": una sola vez, 30 minutos, y como
// mucho 3 pedidos por hora por cuenta (que no sirva para llenarle el
// correo a nadie).
const MINUTOS_ENLACE_RECUPERACION = 30;
const PEDIDOS_DE_RECUPERACION_POR_HORA = 3;
const ENLACE_INVALIDO =
  'El enlace para cambiar la contraseña venció o ya se usó. Pide uno nuevo.';

// bcrypt con costo 12 (unos 250 ms por intento): caro para quien prueba
// millones, imperceptible para quien entra una vez.
const COSTO_BCRYPT = 12;

// Hash de una clave al azar que nadie conoce. Cuando el email no existe
// se compara igual contra esto: la respuesta tarda lo mismo que con una
// contraseña equivocada, y el tiempo no delata qué emails tienen cuenta.
const HASH_FICTICIO =
  '$2b$12$t0N6i4B1h6Wa5F9OEgCijuTRg7GWvi9NVbdTL2u/Nb2QC/rHA8opu';

const hashDeToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export type { MotivoRevocacion };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(RecuperacionPassword)
    private readonly recuperacionRepo: Repository<RecuperacionPassword>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly seguridad: SeguridadService,
    private readonly mail: MailService,
    private readonly dosPasos: DosPasosService,
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
  async registrar(
    dto: RegistroDto,
    contexto: ContextoPedido = {},
  ): Promise<TokenPair> {
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
        // El formulario no deja registrarse sin aceptarlos (RegistroDto).
        terminosAceptadosEn: new Date(),
      });
      return usuarioRepo.save(nuevoUsuario);
    });

    await this.seguridad.registrar('cuenta_creada', { usuario, contexto });
    return this.emitirTokens(usuario, contexto);
  }

  async login(
    email: string,
    password: string,
    contexto: ContextoPedido = {},
  ): Promise<RespuestaIngreso> {
    // Antes de leer la cuenta: si mientras se verifica la contraseña se la
    // cambian (o se cierran sus sesiones), este ingreso ya no vale.
    const verificadoEn = new Date();
    const usuario = await this.usuarioRepo.findOne({
      where: { email, activo: true },
    });

    if (!usuario) {
      // Mismo trabajo y mismo mensaje que con una contraseña equivocada.
      await bcrypt.compare(password, HASH_FICTICIO);
      await this.seguridad.registrar('ingreso_fallido', { email, contexto });
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      await this.seguridad.registrar('ingreso_bloqueado', {
        usuario,
        contexto,
      });
      throw new HttpException(
        this.mensajeDeBloqueo(usuario.bloqueadoHasta),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      await this.anotarIntentoFallido(usuario, contexto);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    // Entró: se olvidan los intentos fallidos. Y si su contraseña se cifró
    // con un costo viejo (más barato de atacar), se vuelve a cifrar ahora
    // que la tenemos: nadie tiene que cambiarla.
    const cambios: Partial<Usuario> = {};
    // Con la verificación en dos pasos, los intentos se olvidan recién con
    // el código bien: si no, la contraseña correcta reiniciaría la cuenta y
    // se podrían probar códigos sin fin.
    const pideCodigo = usuario.dosPasosActivoDesde !== null;
    if (
      !pideCodigo &&
      (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta)
    ) {
      cambios.intentosFallidos = 0;
      cambios.bloqueadoHasta = null;
    }
    if (bcrypt.getRounds(usuario.passwordHash) < COSTO_BCRYPT) {
      cambios.passwordHash = await this.hashPassword(password);
    }
    if (Object.keys(cambios).length > 0) {
      await this.usuarioRepo.update(usuario.id, cambios);
    }

    if (pideCodigo) return this.desafio(usuario, 'password', verificadoEn);

    const tokens = await this.emitirTokens(usuario, contexto, verificadoEn);
    await this.seguridad.registrar('ingreso', { usuario, contexto });
    return tokens;
  }

  // --- Verificación en dos pasos al ingresar ---

  private desafio(
    usuario: Usuario,
    metodo: PayloadDesafio['metodo'],
    verificadoEn: Date,
  ): DesafioDosPasos {
    const payload: PayloadDesafio = {
      sub: usuario.id,
      tipo: 'dos-pasos',
      metodo,
      verificadoEn: verificadoEn.getTime(),
    };
    return {
      requiereCodigo: true,
      desafio: this.jwtService.sign(payload, {
        secret: this.secretoDelDesafio(),
        expiresIn: SEGUNDOS_PARA_EL_CODIGO,
      }),
    };
  }

  // Un secreto propio: un desafío nunca sirve como token de acceso.
  private secretoDelDesafio(): string {
    return `${this.configService.get<string>('jwt.accessSecret')}:dos-pasos`;
  }

  /**
   * Segundo paso del ingreso: el código de la app (o uno de recuperación).
   * Un código mal cuenta como un intento fallido más: tras varios, la
   * cuenta se bloquea unos minutos, igual que con la contraseña.
   */
  async completarConCodigo(
    desafio: string,
    codigo: string,
    contexto: ContextoPedido = {},
  ): Promise<TokenPair> {
    let payload: PayloadDesafio;
    try {
      payload = this.jwtService.verify<PayloadDesafio>(desafio, {
        secret: this.secretoDelDesafio(),
      });
    } catch {
      throw new UnauthorizedException(
        'Pasó demasiado tiempo desde que pusiste la contraseña. Vuelve a ingresar.',
      );
    }
    if (payload.tipo !== 'dos-pasos') {
      throw new UnauthorizedException('Vuelve a ingresar.');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub, activo: true },
    });
    if (!usuario?.dosPasosActivoDesde) {
      throw new UnauthorizedException('Vuelve a ingresar.');
    }
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      await this.seguridad.registrar('ingreso_bloqueado', {
        usuario,
        contexto,
      });
      throw new HttpException(
        this.mensajeDeBloqueo(usuario.bloqueadoHasta),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const como = await this.dosPasos.verificarParaIngresar(usuario.id, codigo);
    if (!como) {
      await this.anotarIntentoFallido(
        usuario,
        contexto,
        'codigo_dos_pasos_fallido',
      );
      throw new UnauthorizedException(
        'El código no es correcto. Usa el que muestra ahora la app (cambia cada 30 segundos) o uno de recuperación.',
      );
    }

    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await this.usuarioRepo.update(usuario.id, {
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
    }
    if (como === 'recuperacion') {
      await this.seguridad.registrar('codigo_recuperacion_usado', {
        usuario,
        contexto,
      });
    }
    // La contraseña (o Google) se verificó cuando se emitió el desafío.
    const verificadoEn = new Date(
      payload.verificadoEn ?? (payload.iat ?? 0) * 1000,
    );
    const tokens = await this.emitirTokens(usuario, contexto, verificadoEn);
    await this.seguridad.registrar(
      payload.metodo === 'google' ? 'ingreso_google' : 'ingreso',
      { usuario, contexto },
    );
    return tokens;
  }

  private async anotarIntentoFallido(
    usuario: Usuario,
    contexto: ContextoPedido,
    tipo: TipoEventoSeguridad = 'ingreso_fallido',
  ): Promise<void> {
    await bloqueo.anotarIntentoFallido(
      this.dataSource.manager,
      this.seguridad,
      usuario,
      contexto,
      tipo,
    );
  }

  private mensajeDeBloqueo(hasta: Date): string {
    return bloqueo.mensajeDeBloqueo(hasta);
  }

  // --- Recuperar la contraseña ---

  /**
   * "Olvidé mi contraseña": si el email es de una cuenta activa, le manda
   * un enlace para elegir otra. Responde siempre igual (exista o no la
   * cuenta), para no revelar qué emails están registrados.
   */
  async pedirRecuperacion(
    email: string,
    contexto: ContextoPedido = {},
  ): Promise<void> {
    const usuario = await this.usuarioRepo.findOne({
      where: { email, activo: true },
    });
    await this.seguridad.registrar('recuperacion_pedida', {
      usuario,
      email,
      contexto,
    });
    if (!usuario) return;

    const recientes = await this.recuperacionRepo.count({
      where: {
        usuarioId: usuario.id,
        createdAt: MoreThan(new Date(Date.now() - 60 * 60_000)),
      },
    });
    if (recientes >= PEDIDOS_DE_RECUPERACION_POR_HORA) return;

    // Un enlace nuevo anula los anteriores que no se usaron.
    await this.recuperacionRepo.update(
      { usuarioId: usuario.id, usadaEn: IsNull() },
      { usadaEn: new Date() },
    );

    const token = randomBytes(32).toString('base64url');
    await this.recuperacionRepo.insert({
      usuarioId: usuario.id,
      tokenHash: hashDeToken(token),
      expiraEn: new Date(Date.now() + MINUTOS_ENLACE_RECUPERACION * 60_000),
      ip: contexto.ip?.slice(0, 64) ?? null,
    });

    const enlace = `${this.configService.get<string>('appWebUrl')}/restablecer?token=${token}`;
    const { asunto, html } = correoRecuperacion(
      usuario.nombre,
      enlace,
      MINUTOS_ENLACE_RECUPERACION,
    );
    await this.mail.enviar({ destinatarios: [usuario.email], asunto, html });

    // En desarrollo, sin SMTP configurado, el enlace queda en el log para
    // poder probar. Nunca en producción.
    if (
      this.configService.get<string>('nodeEnv') !== 'production' &&
      !this.configService.get<string>('smtp.host')
    ) {
      console.log(
        `[desarrollo] Enlace para cambiar la contraseña de ${usuario.email}: ${enlace}`,
      );
    }
  }

  /** Si el enlace todavía sirve (para mostrar el formulario o avisar que venció). */
  async verificarRecuperacion(token: string): Promise<void> {
    const recuperacion = await this.recuperacionRepo.findOne({
      where: { tokenHash: hashDeToken(token) },
    });
    if (
      !recuperacion ||
      recuperacion.usadaEn ||
      recuperacion.expiraEn <= new Date()
    ) {
      throw new BadRequestException(ENLACE_INVALIDO);
    }
  }

  /**
   * Cambia la contraseña con el enlace del email: el enlace deja de
   * servir, la cuenta se desbloquea y se cierran todas sus sesiones (si
   * alguien más había entrado, queda afuera). Avisa por email.
   */
  async restablecerPassword(
    token: string,
    password: string,
    contexto: ContextoPedido = {},
  ): Promise<void> {
    const passwordHash = await this.hashPassword(password);

    const usuario = await this.dataSource.transaction(async (manager) => {
      const recuperacion = await manager
        .getRepository(RecuperacionPassword)
        .findOne({
          where: { tokenHash: hashDeToken(token) },
          // Dos pedidos con el mismo enlace a la vez: el segundo espera y lo
          // encuentra ya usado.
          lock: { mode: 'pessimistic_write' },
        });
      if (
        !recuperacion ||
        recuperacion.usadaEn ||
        recuperacion.expiraEn <= new Date()
      ) {
        throw new BadRequestException(ENLACE_INVALIDO);
      }
      const cuenta = await manager.getRepository(Usuario).findOne({
        where: { id: recuperacion.usuarioId, activo: true },
      });
      if (!cuenta) throw new BadRequestException(ENLACE_INVALIDO);

      await manager.getRepository(Usuario).update(cuenta.id, {
        passwordHash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        // El enlace llegó a su correo: el correo es suyo.
        emailVerificadoEn: cuenta.emailVerificadoEn ?? new Date(),
      });
      await manager
        .getRepository(RecuperacionPassword)
        .update(recuperacion.id, { usadaEn: new Date() });
      await this.revocarSesionesDe(cuenta.id, 'password_cambiada', manager);
      return cuenta;
    });

    await this.seguridad.registrar('password_restablecida', {
      usuario,
      contexto,
    });
    const { asunto, html } = correoPasswordCambiada(usuario.nombre, new Date());
    await this.mail.enviar({ destinatarios: [usuario.email], asunto, html });
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
      dosPasos: usuario.dosPasosActivoDesde !== null,
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
  async loginConClerk(
    clerkToken: string,
    contexto: ContextoPedido = {},
  ): Promise<RespuestaIngreso> {
    const verificadoEn = new Date();
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

    // 1) Ya vinculada: por el ID de Google, no por el correo.
    let usuario = await this.usuarioRepo.findOne({
      where: { clerkUserId: claims.sub, activo: true },
    });
    // 2) Una cuenta con ese correo: se vincula solo si su correo ya se
    //    demostró; si no, podría ser de otra persona que lo registró.
    if (!usuario) {
      const conEseCorreo = await this.usuarioRepo.findOne({
        where: { email, activo: true },
      });
      if (conEseCorreo) {
        usuario = await this.vincularConGoogle(conEseCorreo, claims.sub);
      }
    }

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
          return this.vincularConGoogle(yaCreado, claims.sub, manager);
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
          // Google ya verificó el correo; la cuenta queda atada a su ID.
          clerkUserId: claims.sub,
          emailVerificadoEn: new Date(),
          // Al lado de "Continuar con Google" se avisa que continuar es
          // aceptar los términos y la política de privacidad.
          terminosAceptadosEn: new Date(),
        });
        return usuarioRepo.save(nuevoUsuario);
      });
    }

    // Con Google también: la verificación en dos pasos es de la cuenta.
    if (usuario.dosPasosActivoDesde) {
      return this.desafio(usuario, 'google', verificadoEn);
    }

    const tokens = await this.emitirTokens(usuario, contexto, verificadoEn);
    await this.seguridad.registrar('ingreso_google', { usuario, contexto });
    return tokens;
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
        await this.seguridad.registrar('sesion_revocada_por_reuso', {
          usuario: {
            id: sesion.usuarioId,
            tenantId: sesion.tenantId,
            email: '',
          },
        });
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
          ? 'Por seguridad cerramos tu sesión: inicia sesión de nuevo'
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
  async cerrarSesion(
    refreshToken: string,
    contexto: ContextoPedido = {},
  ): Promise<void> {
    const payload = await this.verificarRefresh(refreshToken, true);
    if (!payload?.sid) return;
    await this.seguridad.registrar('cierre_sesion', {
      usuario: { id: payload.sub, tenantId: payload.tenantId, email: '' },
      contexto,
    });
    await this.dataSource
      .getRepository(Sesion)
      .update(
        { id: payload.sid, revocadaEn: IsNull() },
        { revocadaEn: new Date(), motivoRevocacion: 'cierre' },
      );
  }

  /**
   * "Cerrar sesión en todos mis dispositivos": la persona corta todas sus
   * sesiones (también la de este dispositivo). Por ejemplo, si perdió el
   * celular o entró desde una computadora ajena.
   */
  async cerrarTodasLasSesiones(
    usuario: { id: string; tenantId: string },
    contexto: ContextoPedido = {},
  ): Promise<void> {
    await this.revocarSesionesDe(usuario.id, 'cerradas_por_el_usuario');
    await this.seguridad.registrar('sesiones_cerradas', {
      usuario: { ...usuario, email: '' },
      contexto,
    });
  }

  /**
   * Vincula una cuenta existente con la cuenta de Google que acaba de
   * entrar, solo si el correo de la cuenta ya se demostró. Si no, quien
   * entra con Google tiene que entrar con la contraseña o recuperarla (el
   * enlace llega a su correo y deja afuera a quien la haya registrado).
   */
  private async vincularConGoogle(
    usuario: Usuario,
    clerkUserId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Usuario> {
    if (usuario.clerkUserId && usuario.clerkUserId !== clerkUserId) {
      throw new ConflictException(
        'Esta cuenta ya está vinculada a otra cuenta de Google.',
      );
    }
    if (!usuario.emailVerificadoEn) {
      throw new ConflictException(
        'Ya hay una cuenta de KontaGo con este correo. Entra con tu contraseña; si no la creaste tú o no la recuerdas, usa "¿Olvidaste tu contraseña?" y después podrás entrar con Google.',
      );
    }
    if (!usuario.clerkUserId) {
      await manager.getRepository(Usuario).update(usuario.id, { clerkUserId });
      usuario.clerkUserId = clerkUserId;
    }
    return usuario;
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
    await bloqueo.revocarSesiones(manager, usuarioId, motivo);
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

  /**
   * Inicio de sesión: una sesión nueva y su primer par de tokens.
   *
   * `verificadoEn`: cuándo se comprobó la contraseña (o Google). Si desde
   * entonces se cortaron las sesiones de la cuenta (le cambiaron la
   * contraseña, la desactivaron), no se crea: quien la conocía queda
   * afuera aunque su ingreso ya estuviera en curso. Se lee la cuenta con
   * bloqueo compartido, así un cambio concurrente espera o ya se ve.
   */
  private async emitirTokens(
    usuario: Usuario,
    contexto: ContextoPedido = {},
    verificadoEn: Date = new Date(),
  ): Promise<TokenPair> {
    const sesion = await this.dataSource.transaction(async (manager) => {
      const cuenta = await manager.getRepository(Usuario).findOne({
        where: { id: usuario.id, activo: true },
        lock: { mode: 'pessimistic_read' },
      });
      if (!cuenta) throw new UnauthorizedException('Usuario desactivado');
      if (
        cuenta.sesionesValidasDesde &&
        cuenta.sesionesValidasDesde > verificadoEn
      ) {
        throw new UnauthorizedException(
          'Tu contraseña o tu acceso cambió mientras ingresabas. Vuelve a ingresar.',
        );
      }
      const sesionRepo = manager.getRepository(Sesion);
      return sesionRepo.save(
        sesionRepo.create({
          usuarioId: usuario.id,
          tenantId: usuario.tenantId,
          jtiActual: randomUUID(),
          expiraEn: this.vencimientoDeSesion(),
          ip: contexto.ip?.slice(0, 64) ?? null,
          userAgent: contexto.userAgent?.slice(0, 200) ?? null,
        }),
      );
    });
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
    return bcrypt.hash(password, COSTO_BCRYPT);
  }
}
