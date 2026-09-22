import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { ClerkLoginDto } from './dto/clerk-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

// Máximo 10 intentos por minuto por IP en login/registro/Clerk: frena
// la prueba masiva de contraseñas sin molestar a una persona real.
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registrar(@Body() dto: RegistroDto) {
    return this.authService.registrar(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
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
  loginConClerk(@Body() dto: ClerkLoginDto) {
    return this.authService.loginConClerk(dto.clerkToken);
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

  @Get('perfil')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.obtenerPerfil(user.usuarioId, user.tenantId);
  }
}
