import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';

@Controller('ventas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearVentaDto) {
    return this.ventasService.crearVenta(user.tenantId, user.usuarioId, dto);
  }

  // Ingreso, ganancia e IVA del día: información del dueño, no del cajero.
  @Get('resumen-dia')
  @Roles(Rol.ADMIN)
  resumenDelDia(@CurrentUser() user: AuthenticatedUser) {
    return this.ventasService.obtenerResumenDelDia(user.tenantId);
  }
}
