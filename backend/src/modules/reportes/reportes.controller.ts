import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Rol } from '../../common/enums/rol.enum';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RangoFechasDto } from '../ventas/dto/consulta-ventas.dto';
import { armarRango } from '../ventas/rango-fechas';
import { ReportesService } from './reportes.service';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  // El reporte del período en Excel, para el contador (?desde&hasta, hasta
  // 92 días como el resto). Solo admin: trae costos y ganancias.
  @Get('excel')
  async excel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() consulta: RangoFechasDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { nombre, contenido } = await this.reportesService.excel(
      user,
      armarRango(consulta.desde, consulta.hasta),
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(contenido);
  }
}
