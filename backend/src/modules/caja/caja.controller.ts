import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CajaService } from './caja.service';
import { AbrirCajaDto, CerrarCajaDto, MovimientoCajaDto } from './dto/caja.dto';
import { RangoFechasDto } from '../ventas/dto/consulta-ventas.dto';
import { armarRango } from '../ventas/rango-fechas';

/**
 * Caja de cada cajero (y del admin, que también vende). Abrir, retirar o
 * ingresar efectivo y cerrar son de cualquier rol, sobre el turno propio.
 * Ver todos los turnos y cerrar el de otro, solo admin.
 */
@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  // Envuelto en un objeto: Nest responde un null como cuerpo vacío, y los
  // clientes toman un cuerpo vacío como corte de conexión.
  @Get('actual')
  async actual(@CurrentUser() user: AuthenticatedUser) {
    return { turno: await this.cajaService.actual(user) };
  }

  @Post('abrir')
  abrir(@CurrentUser() user: AuthenticatedUser, @Body() dto: AbrirCajaDto) {
    return this.cajaService.abrir(user, dto);
  }

  @Post('movimientos')
  movimiento(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MovimientoCajaDto,
  ) {
    return this.cajaService.registrarMovimiento(user, dto);
  }

  @Post('cerrar')
  @HttpCode(HttpStatus.OK)
  cerrar(@CurrentUser() user: AuthenticatedUser, @Body() dto: CerrarCajaDto) {
    return this.cajaService.cerrarPropio(user, dto);
  }

  @Get('turnos')
  @Roles(Rol.ADMIN)
  turnos(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: RangoFechasDto,
  ) {
    return this.cajaService.listar(
      user,
      armarRango(consulta.desde, consulta.hasta),
    );
  }

  @Post('turnos/:id/cerrar')
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.OK)
  cerrarDeOtro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarCajaDto,
  ) {
    return this.cajaService.cerrarDeOtro(user, id, dto);
  }
}
