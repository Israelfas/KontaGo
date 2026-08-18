import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { InventarioService } from './inventario.service';
import { RegistrarAbastecimientoDto } from './dto/registrar-abastecimiento.dto';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';

@Controller('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // Restringido a admin: cambia el costo del producto y el stock, no es
  // algo que un cajero deba poder hacer libremente (ver riesgo de roles
  // del spec, sección 8).
  @Post('abastecimiento')
  @Roles(Rol.ADMIN)
  registrarAbastecimiento(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegistrarAbastecimientoDto,
  ) {
    return this.inventarioService.registrarAbastecimiento(
      user.tenantId,
      user.usuarioId,
      dto,
    );
  }

  @Post('merma')
  @Roles(Rol.ADMIN)
  registrarMerma(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegistrarMermaDto,
  ) {
    return this.inventarioService.registrarMerma(
      user.tenantId,
      user.usuarioId,
      dto,
    );
  }

  @Get('resumen-dia')
  resumenDelDia(@CurrentUser() user: AuthenticatedUser) {
    return this.inventarioService.obtenerResumenDelDia(user.tenantId);
  }
}
