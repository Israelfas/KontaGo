import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { limiteDeIntentos } from '../../common/seguridad/limite-de-intentos';
import { AuthService, type RespuestaIngreso } from './auth.service';
import {
  COOKIE_SESION,
  borrarCookieDeSesion,
  esClienteWeb,
  guardarSesionEnCookie,
  leerCookie,
} from '../../common/seguridad/cookie-sesion';
import { DosPasosService } from './dos-pasos.service';
import { CodigoDosPasosDto, IngresoConCodigoDto } from './dto/dos-pasos.dto';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { ClerkLoginDto } from './dto/clerk-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  PedirRecuperacionDto,
  RestablecerPasswordDto,
  VerificarRecuperacionDto,
} from './dto/recuperacion.dto';
import type { ContextoPedido } from './seguridad.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

// Máximo 10 intentos por minuto por IP en login/registro/Clerk: frena
// la prueba masiva de contraseñas sin molestar a una persona real.
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly dosPasos: DosPasosService,
    private readonly config: ConfigService,
  ) {}

  // De dónde vino el pedido, para el registro de eventos de seguridad.
  private contexto(ip: string, userAgent?: string): ContextoPedido {
    return { ip, userAgent: userAgent ?? null };
  }

  // La cookie solo por https en producción (en la PC es http).
  private get cookieSegura(): boolean {
    return this.config.get<string>('nodeEnv') === 'production';
  }

  /**
   * A la web, el token de renovación le llega en una cookie httpOnly (y
   * no en el cuerpo, donde un script podría leerlo); a la app, como
   * siempre. El desafío de la verificación en dos pasos no lleva tokens.
   */
  private entregar(
    respuesta: RespuestaIngreso,
    req: Request,
    res: Response,
  ): RespuestaIngreso | { accessToken: string } {
    if (!esClienteWeb(req) || !('refreshToken' in respuesta)) return respuesta;
    guardarSesionEnCookie(
      res,
      respuesta.refreshToken,
      this.config.get<number>('jwt.refreshExpiresInSeconds')!,
      this.cookieSegura,
    );
    return { accessToken: respuesta.accessToken };
  }

  /** El token de renovación: del cuerpo (app) o de la cookie (web). */
  private refreshDe(dto: RefreshDto, req: Request): string | undefined {
    return dto.refreshToken || leerCookie(req, COOKIE_SESION);
  }

  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  async registrar(
    @Body() dto: RegistroDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.entregar(
      await this.authService.registrar(dto, this.contexto(ip, userAgent)),
      req,
      res,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.entregar(
      await this.authService.login(
        dto.email,
        dto.password,
        this.contexto(ip, userAgent),
      ),
      req,
      res,
    );
  }

  /**
   * "Olvidé mi contraseña": responde 204 siempre, exista o no el email
   * (no revela qué emails tienen cuenta). Pocos pedidos por IP: cada uno
   * manda un email.
   */
  @Post('olvide-password')
  @Throttle({ default: { limit: limiteDeIntentos(5), ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async pedirRecuperacion(
    @Body() dto: PedirRecuperacionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.pedirRecuperacion(
      dto.email,
      this.contexto(ip, userAgent),
    );
  }

  /** 204 si el enlace del email todavía sirve; 400 si venció o ya se usó. */
  @Post('restablecer-password/verificar')
  @Throttle({ default: { limit: limiteDeIntentos(20), ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async verificarRecuperacion(@Body() dto: VerificarRecuperacionDto) {
    await this.authService.verificarRecuperacion(dto.token);
  }

  /** Contraseña nueva con el enlace del email. Cierra todas las sesiones. */
  @Post('restablecer-password')
  @Throttle({ default: { limit: limiteDeIntentos(10), ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restablecerPassword(
    @Body() dto: RestablecerPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.restablecerPassword(
      dto.token,
      dto.password,
      this.contexto(ip, userAgent),
    );
  }

  /**
   * Puente con Clerk: el cliente (web o móvil) ya hizo el login/registro
   * con Clerk (Google, email, lo que sea) y manda acá el token de sesión
   * de Clerk. KontaGo lo verifica, y devuelve SU PROPIO par de tokens
   * (mismo formato de siempre) — de ahí en más, todo el resto de la app
   * funciona exactamente igual que con /auth/login.
   */
  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async loginConClerk(
    @Body() dto: ClerkLoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.entregar(
      await this.authService.loginConClerk(
        dto.clerkToken,
        this.contexto(ip, userAgent),
      ),
      req,
      res,
    );
  }

  /**
   * Renueva la sesión: recibe el refreshToken (7 días) y devuelve un par
   * nuevo. Sin esto, el accessToken (15 min) vencía y la persona quedaba
   * deslogueada en medio de la jornada.
   */
  // Más holgado: lo dispara la app sola, y varios dispositivos de la
  // misma tienda comparten IP.
  @Post('refresh')
  @Throttle({ default: { limit: limiteDeIntentos(30), ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refrescar(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.refreshDe(dto, req);
    if (!refreshToken) {
      throw new UnauthorizedException('Sesión vencida, inicia sesión de nuevo');
    }
    try {
      return this.entregar(
        await this.authService.refrescar(refreshToken),
        req,
        res,
      );
    } catch (err) {
      // Una cookie que ya no sirve no tiene que quedar dando vueltas.
      if (esClienteWeb(req)) borrarCookieDeSesion(res, this.cookieSegura);
      throw err;
    }
  }

  /**
   * Cierra la sesión del refreshToken: el accessToken y el refreshToken
   * dejan de servir. Responde 204 siempre (un token que no sirve ya es
   * una sesión cerrada).
   */
  @Post('logout')
  @Throttle({ default: { limit: limiteDeIntentos(30), ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cerrarSesion(
    @Body() dto: RefreshDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const refreshToken = this.refreshDe(dto, req);
    if (esClienteWeb(req)) borrarCookieDeSesion(res, this.cookieSegura);
    if (!refreshToken) return;
    await this.authService.cerrarSesion(
      refreshToken,
      this.contexto(ip, userAgent),
    );
  }

  /** Cierra la sesión en todos los dispositivos de quien lo pide (también este). */
  @Post('cerrar-sesiones')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cerrarTodasLasSesiones(
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (esClienteWeb(req)) borrarCookieDeSesion(res, this.cookieSegura);
    await this.authService.cerrarTodasLasSesiones(
      { id: user.usuarioId, tenantId: user.tenantId },
      this.contexto(ip, userAgent),
    );
  }

  @Get('perfil')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.obtenerPerfil(user.usuarioId, user.tenantId);
  }

  // --- Verificación en dos pasos ---

  /**
   * Segundo paso del ingreso, si la cuenta lo tiene: /auth/login (o
   * /auth/clerk) devolvió { requiereCodigo, desafio } en vez de tokens.
   * Pocos intentos por IP; además, cada código mal suma al bloqueo de la
   * cuenta.
   */
  @Post('login/codigo')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: limiteDeIntentos(10), ttl: 60_000 } })
  async completarConCodigo(
    @Body() dto: IngresoConCodigoDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.entregar(
      await this.authService.completarConCodigo(
        dto.desafio,
        dto.codigo,
        this.contexto(ip, userAgent),
      ),
      req,
      res,
    );
  }

  @Get('dos-pasos')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  estadoDosPasos(@CurrentUser() user: AuthenticatedUser) {
    return this.dosPasos.estado(user.usuarioId);
  }

  // Paso 1: el secreto para escanear (queda pendiente hasta confirmarlo).
  @Post('dos-pasos/iniciar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  iniciarDosPasos(@CurrentUser() user: AuthenticatedUser) {
    return this.dosPasos.iniciar(user.usuarioId);
  }

  // Paso 2: con un código de la app queda activada; devuelve los códigos
  // de recuperación (se muestran una sola vez).
  @Post('dos-pasos/activar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  activarDosPasos(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CodigoDosPasosDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.dosPasos.activar(
      user.usuarioId,
      dto.codigo,
      this.contexto(ip, userAgent),
    );
  }

  @Post('dos-pasos/desactivar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async desactivarDosPasos(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CodigoDosPasosDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.dosPasos.desactivar(
      user.usuarioId,
      dto.codigo,
      this.contexto(ip, userAgent),
    );
  }
}
