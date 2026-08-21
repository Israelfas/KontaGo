import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { Rol } from '../../common/enums/rol.enum';
import { Producto } from '../productos/entities/producto.entity';
import { ProductosService } from '../productos/productos.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly productosService: ProductosService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Corre todos los días a las 8:00am hora de Ecuador (fijo por
   * timeZone, no depende de la TZ del proceso — ver notas de zona
   * horaria en ventas.service.ts). Un cron diario alcanza para el MVP
   * de un solo país; si algún día hay tenants en otras zonas, este es
   * el mismo punto que habría que ajustar por tenant.
   */
  @Cron('0 8 * * *', { timeZone: 'America/Guayaquil' })
  async enviarNotificacionesDeVencimientoDeTodosLosTenants(): Promise<void> {
    const tenants = await this.tenantRepo.find({ where: { activo: true } });
    for (const tenant of tenants) {
      await this.enviarNotificacionesDeVencimiento(tenant.id);
    }
  }

  /**
   * Envía (si corresponde) el correo de productos por vencer de un
   * tenant puntual. Separado del cron para poder disparar manualmente
   * desde el endpoint de prueba sin esperar a las 8am.
   */
  async enviarNotificacionesDeVencimiento(
    tenantId: string,
  ): Promise<{ enviado: boolean; cantidadProductos: number }> {
    const dias = this.config.get<number>('alertas.diasVencimientoDefault')!;
    const { porVencer } = await this.productosService.obtenerAlertas(
      tenantId,
      dias,
    );

    if (porVencer.length === 0) {
      return { enviado: false, cantidadProductos: 0 };
    }

    const admins = await this.usuarioRepo.find({
      where: { tenantId, rol: Rol.ADMIN, activo: true },
    });
    const destinatarios = admins.map((a) => a.email);

    if (destinatarios.length === 0) {
      this.logger.warn(
        `Tenant ${tenantId} tiene productos por vencer pero ningún admin activo con correo`,
      );
      return { enviado: false, cantidadProductos: porVencer.length };
    }

    await this.mailService.enviar({
      destinatarios,
      asunto: `KontaGo · ${porVencer.length} producto${porVencer.length === 1 ? '' : 's'} por vencer`,
      html: this.construirHtml(porVencer, dias),
    });

    return { enviado: true, cantidadProductos: porVencer.length };
  }

  private construirHtml(productos: Producto[], dias: number): string {
    const filas = productos
      .map((p) => {
        const fecha = p.fechaVencimiento
          ? new Date(p.fechaVencimiento).toLocaleDateString('es-EC', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : '—';
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;">${p.nombre}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;text-align:right;">${p.stock}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;text-align:right;">${fecha}</td>
        </tr>`;
      })
      .join('');

    return `
      <div style="font-family:sans-serif;color:#1c2b3a;max-width:480px;margin:0 auto;">
        <h2 style="margin-bottom:4px;">Productos por vencer</h2>
        <p style="color:#5b6b7a;margin-top:0;">
          Vencen dentro de los próximos ${dias} días.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="text-align:left;color:#5b6b7a;font-size:12px;text-transform:uppercase;">
              <th style="padding:8px 12px;">Producto</th>
              <th style="padding:8px 12px;text-align:right;">Stock</th>
              <th style="padding:8px 12px;text-align:right;">Vence</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;
  }
}
