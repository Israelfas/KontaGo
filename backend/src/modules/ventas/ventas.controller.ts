import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';

@Controller('ventas')
@UseGuards(JwtAuthGuard)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearVentaDto) {
    return this.ventasService.crearVenta(user.tenantId, user.usuarioId, dto);
  }

  @Get('resumen-dia')
  resumenDelDia(@CurrentUser() user: AuthenticatedUser) {
    return this.ventasService.obtenerResumenDelDia(user.tenantId);
  }
}
