import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Tenant } from './entities/tenant.entity';
import { ActualizarTiendaDto, TiendaDto } from './dto/tienda.dto';

export function aTiendaDto(tenant: Tenant): TiendaDto {
  return {
    nombre: tenant.nombre,
    razonSocial: tenant.razonSocial,
    ruc: tenant.ruc,
    direccion: tenant.direccion,
    telefono: tenant.telefono,
    mensajeTicket: tenant.mensajeTicket,
  };
}

/** Los datos de la tienda (los que salen en el ticket). Solo el admin. */
@Controller('tienda')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class TiendaController {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  @Get()
  async obtener(@CurrentUser() user: AuthenticatedUser): Promise<TiendaDto> {
    return aTiendaDto(
      await this.tenantRepo.findOneByOrFail({ id: user.tenantId }),
    );
  }

  @Patch()
  async actualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ActualizarTiendaDto,
  ): Promise<TiendaDto> {
    const tenant = await this.tenantRepo.findOneByOrFail({ id: user.tenantId });
    if (dto.nombre !== undefined) tenant.nombre = dto.nombre;
    if (dto.razonSocial !== undefined) tenant.razonSocial = dto.razonSocial;
    if (dto.ruc !== undefined) tenant.ruc = dto.ruc;
    if (dto.direccion !== undefined) tenant.direccion = dto.direccion;
    if (dto.telefono !== undefined) tenant.telefono = dto.telefono;
    if (dto.mensajeTicket !== undefined)
      tenant.mensajeTicket = dto.mensajeTicket;
    return aTiendaDto(await this.tenantRepo.save(tenant));
  }
}
