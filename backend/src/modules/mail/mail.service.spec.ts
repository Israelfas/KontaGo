import { ConfigService } from '@nestjs/config';
import { MailService, separarRemitente } from './mail.service';

function servicio(valores: Record<string, unknown>): MailService {
  return new MailService(new ConfigService(valores));
}

describe('correo', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('separa el nombre y el correo del remitente', () => {
    expect(separarRemitente('KontaGo <hola@tienda.com>')).toEqual({
      name: 'KontaGo',
      email: 'hola@tienda.com',
    });
    expect(separarRemitente('"Tienda Rosa" <rosa@x.com>')).toEqual({
      name: 'Tienda Rosa',
      email: 'rosa@x.com',
    });
    expect(separarRemitente('solo@correo.com')).toEqual({
      email: 'solo@correo.com',
    });
  });

  it('con BREVO_API_KEY manda por la API de Brevo', async () => {
    const llamadas: [string, RequestInit][] = [];
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      llamadas.push([url, init]);
      return Promise.resolve(new Response('{}', { status: 201 }));
    });

    const mail = servicio({
      correo: { remitente: 'KontaGo <hola@tienda.com>', brevoApiKey: 'clave' },
      smtp: { host: '' },
    });
    expect(mail.configurado).toBe(true);
    await mail.enviar({
      destinatarios: ['rosa@x.com'],
      asunto: 'Hola',
      html: '<p>Hola</p>',
    });

    expect(llamadas).toHaveLength(1);
    const [url, init] = llamadas[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('clave');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'KontaGo', email: 'hola@tienda.com' },
      to: [{ email: 'rosa@x.com' }],
      subject: 'Hola',
      htmlContent: '<p>Hola</p>',
    });
  });

  it('si Brevo rechaza el envío, no rompe el pedido', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('remitente sin verificar', { status: 400 })),
    );
    const mail = servicio({
      correo: { remitente: 'a@b.com', brevoApiKey: 'clave' },
    });
    await expect(
      mail.enviar({ destinatarios: ['c@d.com'], asunto: 'x', html: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('sin Brevo ni SMTP no manda nada', async () => {
    global.fetch = jest.fn();
    const mail = servicio({ correo: { remitente: 'a@b.com' }, smtp: {} });
    expect(mail.configurado).toBe(false);
    await mail.enviar({ destinatarios: ['c@d.com'], asunto: 'x', html: 'x' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
