import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { InventarioService } from './inventario.service';
import { RegistrarAbastecimientoDto } from './dto/registrar-abastecimiento.dto';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';
import { CorregirLotesDto } from './dto/corregir-lotes.dto';
import { ListarMovimientosDto } from './dto/historial-inventario.dto';
import { RangoFechasDto } from '../ventas/dto/consulta-ventas.dto';
import { armarRango } from '../ventas/rango-fechas';

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

  // Reparto del stock entre fechas de vencimiento, después de revisar la
  // góndola. Solo admin, como el resto del inventario.
  @Put('productos/:id/lotes')
  @Roles(Rol.ADMIN)
  corregirLotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productoId: string,
    @Body() dto: CorregirLotesDto,
  ) {
    return this.inventarioService.corregirLotes(user.tenantId, productoId, dto);
  }

  // Historial: abastecimientos y mermas de un período (hasta 92 días).
  @Get('movimientos')
  @Roles(Rol.ADMIN)
  movimientos(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: ListarMovimientosDto,
  ) {
    return this.inventarioService.listarMovimientos(
      user.tenantId,
      armarRango(consulta.desde, consulta.hasta),
      consulta,
    );
  }

  // Gastado en mercadería y perdido en un período, con sus desgloses.
  @Get('resumen')
  @Roles(Rol.ADMIN)
  resumen(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: RangoFechasDto,
  ) {
    return this.inventarioService.resumenDelPeriodo(
      user.tenantId,
      armarRango(consulta.desde, consulta.hasta),
    );
  }

  // Egresos y pérdidas del día: información del dueño, no del cajero.
  @Get('resumen-dia')
  @Roles(Rol.ADMIN)
  resumenDelDia(@CurrentUser() user: AuthenticatedUser) {
    return this.inventarioService.obtenerResumenDelDia(user.tenantId);
  }
}
