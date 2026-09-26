import { NestExpressApplication } from '@nestjs/platform-express';
import { MailService } from '../src/modules/mail/mail.service';
import {
  CLAVE,
  cliente,
  crearApp,
  crearTienda,
  emailUnico,
} from './utilidades';

// Clerk simulado: quién "entra con Google" lo decide cada prueba.
const mockClerk = { sub: 'user_x', email: 'x@prueba.test' };
jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(() => Promise.resolve({ sub: mockClerk.sub })),
  createClerkClient: () => ({
    users: {
      getUser: () =>
        Promise.resolve({
          firstName: 'Vecina',
          lastName: null,
          primaryEmailAddressId: 'e1',
          emailAddresses: [
            {
              id: 'e1',
              emailAddress: mockClerk.email,
              verification: { status: 'verified' },
            },
          ],
        }),
    },
  }),
}));

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
const tenantDe = (token: string) =>
  (
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      tenantId: string;
    }
  ).tenantId;

describe('Entrar con Google sin robar cuentas (e2e)', () => {
  let app: NestExpressApplication;
  let correos: { destinatarios: string[]; html: string }[];

  beforeAll(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_de_prueba';
    app = await crearApp();
    correos = [];
    jest.spyOn(app.get(MailService), 'enviar').mockImplementation((c) => {
      correos.push(c);
      return Promise.resolve();
    });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.CLERK_SECRET_KEY;
  });

  const conGoogle = (sub: string, email: string) => {
    mockClerk.sub = sub;
    mockClerk.email = email;
    return cliente(app).post('/auth/clerk', { clerkToken: 'token-de-prueba' });
  };

  it('una cuenta registrada con tu correo por otra persona no te atrapa al entrar con Google', async () => {
    // Alguien registra una tienda con el correo de la víctima.
    const atacante = await crearTienda(app, 'Tienda trampa');

    const res = await conGoogle('user_victima', atacante.email).expect(409);
    expect((res.body as { message: string }).message).toMatch(
      /Olvidaste tu contraseña/,
    );

    // La víctima recupera la cuenta con el enlace que le llega al correo…
    await cliente(app)
      .post('/auth/olvide-password', { email: atacante.email })
      .expect(204);
    const enlace = /restablecer\?token=([\w-]+)/.exec(
      correos.filter((c) => c.destinatarios.includes(atacante.email)).at(-1)!
        .html,
    )![1];
    await cliente(app)
      .post('/auth/restablecer-password', {
        token: enlace,
        password: 'la-clave-de-la-victima',
      })
      .expect(204);

    // …y ahora sí entra con Google; quien la registró quedó afuera.
    const tokens = (await conGoogle('user_victima', atacante.email).expect(200))
      .body as Tokens;
    expect(tenantDe(tokens.accessToken)).toBe(tenantDe(atacante.accessToken));
    await cliente(app)
      .post('/auth/login', { email: atacante.email, password: CLAVE })
      .expect(401);
    await cliente(app)
      .post('/auth/refresh', { refreshToken: atacante.refreshToken })
      .expect(401);
  });

  it('con Google se entra por la cuenta de Google, aunque cambie el correo', async () => {
    const email = emailUnico('google');
    const primera = (await conGoogle('user_estable', email).expect(200))
      .body as Tokens;
    const otroCorreo = emailUnico('google-nuevo');
    const segunda = (await conGoogle('user_estable', otroCorreo).expect(200))
      .body as Tokens;
    expect(tenantDe(segunda.accessToken)).toBe(tenantDe(primera.accessToken));
  });

  it('una cuenta vinculada a una cuenta de Google no la toma otra con el mismo correo', async () => {
    const email = emailUnico('google-dueno');
    await conGoogle('user_dueno', email).expect(200);
    await conGoogle('user_otro', email).expect(409);
  });
});
