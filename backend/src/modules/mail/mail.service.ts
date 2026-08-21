import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface EnviarCorreoInput {
  destinatarios: string[];
  asunto: string;
  html: string;
}

/**
 * SMTP genérico vía nodemailer, no atado a un proveedor específico
 * (Gmail, Resend, SendGrid, etc. funcionan todos por SMTP estándar).
 * Configuración en backend/.env: SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 * SMTP_USER, SMTP_PASS, SMTP_FROM.
 *
 * Si SMTP_HOST no está configurado, el servicio queda "apagado": loguea
 * un warning y no envía nada, en vez de tumbar el arranque del backend.
 * Así el resto de la app (incluido el cron de notificaciones) sigue
 * funcionando aunque el correo todavía no esté configurado.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly remitente: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    this.remitente = this.config.get<string>('smtp.from')!;

    if (!host) {
      this.logger.warn(
        'SMTP_HOST no está configurado: los correos se registrarán en el log pero no se enviarán.',
      );
      this.transporter = null;
      return;
    }

    this.transporter = createTransport({
      host,
      port: this.config.get<number>('smtp.port'),
      secure: this.config.get<boolean>('smtp.secure'),
      auth: {
        user: this.config.get<string>('smtp.user'),
        pass: this.config.get<string>('smtp.pass'),
      },
    });
  }

  async enviar({
    destinatarios,
    asunto,
    html,
  }: EnviarCorreoInput): Promise<void> {
    if (destinatarios.length === 0) return;

    if (!this.transporter) {
      this.logger.log(
        `[correo no enviado, SMTP sin configurar] Para: ${destinatarios.join(', ')} — ${asunto}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.remitente,
        to: destinatarios,
        subject: asunto,
        html,
      });
    } catch (error) {
      // Un fallo de envío de correo nunca debe tumbar el cron ni una
      // request; solo se registra para diagnosticar después.
      this.logger.error(
        `Falló el envío de correo a ${destinatarios.join(', ')}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
