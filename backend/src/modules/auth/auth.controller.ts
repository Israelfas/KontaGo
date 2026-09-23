import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
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
  constructor(private readonly authService: AuthService) {}

  // De dónde vino el pedido, para el registro de eventos de seguridad.
  private contexto(ip: string, userAgent?: string): ContextoPedido {
    return { ip, userAgent: userAgent ?? null };
  }

  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registrar(
    @Body() dto: RegistroDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.registrar(dto, this.contexto(ip, userAgent));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(
      dto.email,
      dto.password,
      this.contexto(ip, userAgent),
    );
  }

  /**
   * "Olvidé mi contraseña": responde 204 siempre, exista o no el email
   * (no revela qué emails tienen cuenta). Pocos pedidos por IP: cada uno
   * manda un email.
   */
  @Post('olvide-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async verificarRecuperacion(@Body() dto: VerificarRecuperacionDto) {
    await this.authService.verificarRecuperacion(dto.token);
  }

  /** Contraseña nueva con el enlace del email. Cierra todas las sesiones. */
  @Post('restablecer-password')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
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
  loginConClerk(
    @Body() dto: ClerkLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.loginConClerk(
      dto.clerkToken,
      this.contexto(ip, userAgent),
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  refrescar(@Body() dto: RefreshDto) {
    return this.authService.refrescar(dto.refreshToken);
  }

  /**
   * Cierra la sesión del refreshToken: el accessToken y el refreshToken
   * dejan de servir. Responde 204 siempre (un token que no sirve ya es
   * una sesión cerrada).
   */
  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cerrarSesion(
    @Body() dto: RefreshDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.cerrarSesion(
      dto.refreshToken,
      this.contexto(ip, userAgent),
    );
  }

  @Get('perfil')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.obtenerPerfil(user.usuarioId, user.tenantId);
  }
}
