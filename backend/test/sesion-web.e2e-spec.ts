import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CLAVE, crearApp, crearTienda } from './utilidades';

/** La cookie de sesión que mandó el servidor, tal cual (para reenviarla). */
function cookieDe(res: request.Response): string | undefined {
  const cabecera = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cabecera?.find((c) => c.startsWith('kontago_sesion='));
}
const valor = (cookie: string) => cookie.split(';')[0];

/**
 * La web guarda la sesión en una cookie httpOnly (nada que un script pueda
 * leer); la app sigue recibiendo los tokens en el cuerpo.
 */
describe('Sesión de la web en cookie (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const deLaWeb = (r: request.Test) => r.set('X-Cliente', 'web');

  async function entrarDesdeLaWeb() {
    const { email } = await crearTienda(app);
    const res = await deLaWeb(http().post('/auth/login'))
      .send({ email, password: CLAVE })
      .expect(200);
    return { email, res, cookie: cookieDe(res)! };
  }

  it('al entrar desde la web, la renovación va en una cookie httpOnly y no en el cuerpo', async () => {
    const { res, cookie } = await entrarDesdeLaWeb();
    const cuerpo = res.body as { accessToken?: string; refreshToken?: string };
    expect(cuerpo.accessToken).toBeDefined();
    expect(cuerpo.refreshToken).toBeUndefined();

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/auth/i);
    // En la PC (http) no se marca Secure; en producción sí.
    expect(cookie).not.toMatch(/Secure/i);

    await http()
      .get('/auth/perfil')
      .set('Authorization', `Bearer ${cuerpo.accessToken}`)
      .expect(200);
  });

  it('renueva con la cookie, y la cookie rota', async () => {
    const { cookie } = await entrarDesdeLaWeb();
    const res = await deLaWeb(http().post('/auth/refresh'))
      .set('Cookie', valor(cookie))
      .send({})
      .expect(200);
    expect((res.body as { accessToken: string }).accessToken).toBeDefined();
    expect(res.body).not.toHaveProperty('refreshToken');
    const nueva = cookieDe(res)!;
    expect(valor(nueva)).not.toBe(valor(cookie));
  });

  it('sin cookie ni token, no renueva', async () => {
    await deLaWeb(http().post('/auth/refresh')).send({}).expect(401);
  });

  it('una cookie que no sirve se borra', async () => {
    const res = await deLaWeb(http().post('/auth/refresh'))
      .set('Cookie', 'kontago_sesion=inventada')
      .send({})
      .expect(401);
    expect(cookieDe(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('salir borra la cookie y cierra la sesión', async () => {
    const { cookie } = await entrarDesdeLaWeb();
    const res = await deLaWeb(http().post('/auth/logout'))
      .set('Cookie', valor(cookie))
      .send({})
      .expect(204);
    expect(cookieDe(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    await deLaWeb(http().post('/auth/refresh'))
      .set('Cookie', valor(cookie))
      .send({})
      .expect(401);
  });

  it('la app del celular sigue recibiendo los tokens en el cuerpo, sin cookie', async () => {
    const { email } = await crearTienda(app);
    const res = await http()
      .post('/auth/login')
      .send({ email, password: CLAVE })
      .expect(200);
    const cuerpo = res.body as { refreshToken?: string };
    expect(cuerpo.refreshToken).toBeDefined();
    expect(cookieDe(res)).toBeUndefined();
    await http()
      .post('/auth/refresh')
      .send({ refreshToken: cuerpo.refreshToken })
      .expect(200);
  });

  it('el registro desde la web también deja la sesión en la cookie', async () => {
    const res = await deLaWeb(http().post('/auth/registro'))
      .send({
        nombreTienda: 'Tienda web',
        nombreAdmin: 'Admin',
        email: `web-${Date.now()}@prueba.test`,
        password: CLAVE,
        aceptaTerminos: true,
      })
      .expect(201);
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(cookieDe(res)).toMatch(/HttpOnly/i);
  });
});
