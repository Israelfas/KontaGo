import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';

@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Roles(Rol.ADMIN)
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearProductoDto) {
    return this.productosService.crear(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  actualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.productosService.actualizar(user.tenantId, id, dto);
  }

  @Patch(':id/baja')
  @Roles(Rol.ADMIN)
  darDeBaja(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productosService.darDeBaja(user.tenantId, id);
  }

  @Patch(':id/reactivar')
  @Roles(Rol.ADMIN)
  reactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productosService.reactivar(user.tenantId, id);
  }

  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.productosService.listar(user.tenantId);
  }

  @Get('dados-de-baja')
  @Roles(Rol.ADMIN)
  listarDadosDeBaja(@CurrentUser() user: AuthenticatedUser) {
    return this.productosService.listarDadosDeBaja(user.tenantId);
  }

  @Get('escanear/:codigoBarras')
  escanear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('codigoBarras') codigoBarras: string,
  ) {
    return this.productosService.buscarPorCodigoBarras(
      user.tenantId,
      codigoBarras,
    );
  }

  @Get('alertas')
  alertas(
    @CurrentUser() user: AuthenticatedUser,
    @Query('diasVencimiento') diasVencimientoRaw?: string,
  ) {
    let dias: number | undefined;
    if (diasVencimientoRaw !== undefined) {
      dias = parseInt(diasVencimientoRaw, 10);
      // parseInt("abc") da NaN, y un valor negativo o cero no tiene
      // sentido acá — sin esta validación, cualquiera de los dos casos
      // se colaba hasta el cálculo de fecha (Invalid Date) y de ahí a
      // la consulta a la base, con resultados impredecibles o un 500.
      if (isNaN(dias) || dias <= 0) {
        throw new BadRequestException(
          'diasVencimiento debe ser un número entero positivo',
        );
      }
    }
    return this.productosService.obtenerAlertas(user.tenantId, dias);
  }
}
