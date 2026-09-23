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
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { ListarVentasDto, RangoFechasDto } from './dto/consulta-ventas.dto';
import { armarRango } from './rango-fechas';

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

  // Resumen de un período (?desde=AAAA-MM-DD&hasta=AAAA-MM-DD, hasta 92
  // días; sin fechas es hoy). Solo admin, igual que el resumen del día.
  @Get('resumen')
  @Roles(Rol.ADMIN)
  resumen(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: RangoFechasDto,
  ) {
    return this.ventasService.obtenerResumen(
      user.tenantId,
      armarRango(consulta.desde, consulta.hasta),
    );
  }

  // Ventas de un período, paginadas. Solo admin: el cajero ve las de hoy
  // (/ventas/hoy) para encontrar una a anular; el historial es del dueño.
  @Get()
  @Roles(Rol.ADMIN)
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: ListarVentasDto,
  ) {
    return this.ventasService.listarVentas(
      user.tenantId,
      armarRango(consulta.desde, consulta.hasta),
      consulta.limite,
      consulta.desplazamiento,
    );
  }

  // Cualquier rol: el cajero necesita ver las ventas del día para
  // encontrar cuál hay que anular. No incluye costos ni ganancia.
  @Get('hoy')
  historialDelDia(@CurrentUser() user: AuthenticatedUser) {
    return this.ventasService.obtenerHistorialDelDia(user.tenantId);
  }

  // Solo admin: si un cajero pudiera anular, podría cobrar, anular y
  // quedarse con la plata sin que quede rastro en los números.
  @Post(':id/anular')
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.OK)
  anular(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularVentaDto,
  ) {
    return this.ventasService.anularVenta(
      user.tenantId,
      user.usuarioId,
      id,
      dto,
    );
  }
}
