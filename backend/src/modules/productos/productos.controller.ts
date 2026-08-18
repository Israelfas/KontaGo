import {
  Body,
  Controller,
  Get,
  Param,
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

@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Roles(Rol.ADMIN)
  crear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CrearProductoDto) {
    return this.productosService.crear(user.tenantId, dto);
  }

  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.productosService.listar(user.tenantId);
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
    @Query('diasVencimiento') diasVencimiento?: string,
  ) {
    const dias = diasVencimiento ? parseInt(diasVencimiento, 10) : undefined;
    return this.productosService.obtenerAlertas(user.tenantId, dias);
  }
}
