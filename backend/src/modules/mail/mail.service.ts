import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface EnviarCorreoInput {
  destinatarios: string[];
  asunto: string;
  html: string;
}

const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

/**
 * Manda los correos por uno de dos caminos (configuración en
 * backend/.env):
 *
 * - La API HTTPS de Brevo (BREVO_API_KEY). Es la que sirve en Railway: ahí,
 *   fuera del plan Pro, las conexiones SMTP salientes están bloqueadas.
 * - SMTP genérico vía nodemailer (SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 *   SMTP_USER, SMTP_PASS): Gmail, Resend, SendGrid, etc.
 *
 * Si no hay ninguno, el servicio queda "apagado": loguea un warning y no
 * envía nada, en vez de tumbar el arranque del backend. Así el resto de la
 * app (incluido el cron de notificaciones) sigue funcionando aunque el
 * correo todavía no esté configurado.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly claveBrevo: string;
  private readonly remitente: string;

  constructor(private readonly config: ConfigService) {
    this.remitente = this.config.get<string>('correo.remitente')!;
    this.claveBrevo = this.config.get<string>('correo.brevoApiKey') ?? '';
    if (this.claveBrevo) return;

    const host = this.config.get<string>('smtp.host');
    if (!host) {
      this.logger.warn(
        'Ni BREVO_API_KEY ni SMTP_HOST están configurados: los correos se registrarán en el log pero no se enviarán.',
      );
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

  /** Si los correos salen de verdad (Brevo o SMTP configurado). */
  get configurado(): boolean {
    return !!this.claveBrevo || !!this.transporter;
  }

  async enviar({
    destinatarios,
    asunto,
    html,
  }: EnviarCorreoInput): Promise<void> {
    if (destinatarios.length === 0) return;

    if (!this.configurado) {
      this.logger.log(
        `[correo no enviado, sin configurar] Para: ${destinatarios.join(', ')} — ${asunto}`,
      );
      return;
    }

    try {
      if (this.claveBrevo) {
        await this.enviarPorBrevo(destinatarios, asunto, html);
      } else {
        await this.transporter!.sendMail({
          from: this.remitente,
          to: destinatarios,
          subject: asunto,
          html,
        });
      }
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

  private async enviarPorBrevo(
    destinatarios: string[],
    asunto: string,
    html: string,
  ): Promise<void> {
    const respuesta = await fetch(URL_BREVO, {
      method: 'POST',
      headers: {
        'api-key': this.claveBrevo,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: separarRemitente(this.remitente),
        to: destinatarios.map((email) => ({ email })),
        subject: asunto,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 300);
      throw new Error(`Brevo respondió ${respuesta.status}: ${detalle}`);
    }
  }
}

/** "KontaGo <hola@tienda.com>" → { name: 'KontaGo', email: 'hola@tienda.com' }. */
export function separarRemitente(texto: string): {
  name?: string;
  email: string;
} {
  const partes = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(texto);
  if (!partes) return { email: texto.trim() };
  const nombre = partes[1].trim();
  const email = partes[2].trim();
  return nombre ? { name: nombre, email } : { email };
}
