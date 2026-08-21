import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * Dispara manualmente el correo de vencimientos para el tenant actual,
   * sin esperar al cron de las 8am. Pensado para probar la configuración
   * de SMTP durante desarrollo/deploy, no para uso operativo diario.
   */
  @Post('vencimientos/enviar-ahora')
  @Roles(Rol.ADMIN)
  enviarAhora(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesService.enviarNotificacionesDeVencimiento(
      user.tenantId,
    );
  }
}
