import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';

// Todo el módulo es solo para admin: el equipo lo gestiona el dueño.
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.usuariosService.listar(user.tenantId);
  }

  @Post()
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(user.tenantId, dto);
  }

  @Patch(':id/desactivar')
  desactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.desactivar(user.tenantId, id, user.usuarioId);
  }

  @Patch(':id/reactivar')
  reactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.reactivar(user.tenantId, id);
  }

  @Get(':id/actividad')
  actividad(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.actividad(user.tenantId, id, user.sesionId);
  }

  @Post(':id/cerrar-sesiones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cerrarSesiones(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usuariosService.cerrarSesiones(user.tenantId, id);
  }

  @Patch(':id/desbloquear')
  desbloquear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.desbloquear(user.tenantId, id);
  }

  @Patch(':id/dos-pasos/quitar')
  quitarDosPasos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.quitarDosPasos(
      user.tenantId,
      user.usuarioId,
      id,
    );
  }

  @Patch(':id/password')
  cambiarPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.usuariosService.cambiarPassword(
      user.tenantId,
      id,
      dto.password,
    );
  }
}
