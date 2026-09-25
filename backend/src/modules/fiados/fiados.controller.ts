import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
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
import { FiadosService } from './fiados.service';
import {
  AbonoDto,
  ActualizarClienteDto,
  CrearClienteDto,
} from './dto/fiados.dto';

/**
 * Fiado: los clientes a los que se les fía, lo que debe cada uno y sus
 * abonos. Fiar, anotar un cliente nuevo y recibir un abono es de
 * cualquiera que atienda la caja; editar o archivar un cliente, del admin.
 */
@Controller('clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FiadosController {
  constructor(private readonly fiadosService: FiadosService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('archivados', new ParseBoolPipe({ optional: true }))
    archivados?: boolean,
  ) {
    return this.fiadosService.listar(user.tenantId, archivados ?? false);
  }

  @Post()
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearClienteDto) {
    return this.fiadosService.crear(user.tenantId, dto);
  }

  @Get(':id')
  detalle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fiadosService.detalle(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  actualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.fiadosService.actualizar(user.tenantId, id, dto);
  }

  @Post(':id/abonos')
  abonar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AbonoDto,
  ) {
    return this.fiadosService.abonar(user, id, dto);
  }
}
