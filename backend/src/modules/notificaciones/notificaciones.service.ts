import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
import { fechaLegible, fechaLocal } from '../../common/formato-fecha';

// El nombre del producto lo escribe el usuario: sin escapar, un nombre
// como '<a href=...>' se renderizaría como HTML dentro del correo.
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Entre dos envíos de prueba de la misma tienda. Sin tope, una tienda
// (crear una es gratis) podía mandar correos sin fin con el correo de
// KontaGo, el mismo que manda los de recuperar contraseña de todos.
const ESPERA_ENTRE_PRUEBAS_MS = 60 * 60_000;

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  // Última prueba por tienda. En memoria alcanza con una sola instancia
  // del backend (igual que el límite de intentos de /auth).
  private readonly ultimaPrueba = new Map<string, number>();

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
  /** El correo de vencimientos de ahora, solo para el admin que lo pide. */
  async enviarPrueba(
    tenantId: string,
    usuarioId: string,
  ): Promise<{ enviado: boolean; cantidadProductos: number }> {
    const ahora = Date.now();
    const ultima = this.ultimaPrueba.get(tenantId);
    if (ultima !== undefined && ahora - ultima < ESPERA_ENTRE_PRUEBAS_MS) {
      throw new HttpException(
        'Ya se envió una prueba hace poco. Puedes mandar otra dentro de una hora.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Se anota antes de enviar: dos pedidos juntos no pasan los dos.
    this.ultimaPrueba.set(tenantId, ahora);
    return this.enviarNotificacionesDeVencimiento(tenantId, usuarioId);
  }

  async enviarNotificacionesDeVencimiento(
    tenantId: string,
    soloParaUsuarioId?: string,
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
      where: {
        tenantId,
        rol: Rol.ADMIN,
        activo: true,
        ...(soloParaUsuarioId ? { id: soloParaUsuarioId } : {}),
      },
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
    // Una fila por lote que vence en el período, con SUS unidades: de 18
    // leches pueden vencer 6 (las del 28) y las otras 12 una semana después.
    const hoy = fechaLocal(new Date());
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const hasta = fechaLocal(limite);
    const filas = productos
      .flatMap((p) =>
        (p.lotes ?? [])
          .filter(
            (lote) =>
              lote.fechaVencimiento !== null &&
              lote.fechaVencimiento >= hoy &&
              lote.fechaVencimiento <= hasta,
          )
          .map(
            (lote) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;">${escaparHtml(p.nombre)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;text-align:right;">${lote.cantidad}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e0d8;text-align:right;">${fechaLegible(lote.fechaVencimiento!)}</td>
        </tr>`,
          ),
      )
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
              <th style="padding:8px 12px;text-align:right;">Unidades</th>
              <th style="padding:8px 12px;text-align:right;">Vence</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;
  }
}
