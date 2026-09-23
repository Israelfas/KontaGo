import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import {
  CLAVE,
  cliente,
  crearApp,
  crearCajero,
  crearTienda,
  type Sesion,
} from './utilidades';

/** El payload de un JWT, sin verificar (solo para mirar sid/jti). */
function payload(token: string): { sid?: string; jti?: string } {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ) as { sid?: string; jti?: string };
}

const mensaje = (res: { body: unknown }) =>
  (res.body as { message: string }).message;

describe('Sesiones (login, renovación y cierre)', () => {
  let app: NestExpressApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await crearApp();
    db = app.get(DataSource);
  });
  afterAll(() => app.close());

  const perfil = (token: string) => cliente(app, token).get('/auth/perfil');
  const renovar = (refreshToken: string) =>
    cliente(app).post('/auth/refresh', { refreshToken });

  it('el registro devuelve una sesión que sirve', async () => {
    const tienda = await crearTienda(app);
    await perfil(tienda.accessToken).expect(200);
    expect(payload(tienda.accessToken).sid).toBeDefined();
  });

  it('login con contraseña incorrecta → 401 (sin decir si el email existe)', async () => {
    const tienda = await crearTienda(app);
    const mal = await cliente(app)
      .post('/auth/login', { email: tienda.email, password: 'otra-clave' })
      .expect(401);
    const inexistente = await cliente(app)
      .post('/auth/login', { email: 'nadie@prueba.test', password: CLAVE })
      .expect(401);
    expect(mensaje(mal)).toBe(mensaje(inexistente));
  });

  it('renovar rota el refreshToken y mantiene la sesión', async () => {
    const tienda = await crearTienda(app);
    const res = await renovar(tienda.refreshToken).expect(200);
    const nueva = res.body as Sesion;
    expect(nueva.refreshToken).not.toBe(tienda.refreshToken);
    expect(payload(nueva.refreshToken).sid).toBe(
      payload(tienda.refreshToken).sid,
    );
    expect(payload(nueva.refreshToken).jti).not.toBe(
      payload(tienda.refreshToken).jti,
    );
    await perfil(nueva.accessToken).expect(200);
    // El accessToken anterior sigue sirviendo hasta vencer: es de la
    // misma sesión, que sigue abierta.
    await perfil(tienda.accessToken).expect(200);
  });

  it('dos renovaciones casi a la vez con el mismo token no cierran la sesión', async () => {
    const tienda = await crearTienda(app);
    const primera = (await renovar(tienda.refreshToken).expect(200))
      .body as Sesion;
    // La segunda pestaña llega con el token recién rotado.
    const segunda = (await renovar(tienda.refreshToken).expect(200))
      .body as Sesion;
    // Las dos quedan con el mismo refreshToken vigente (no se bifurca).
    expect(payload(segunda.refreshToken).jti).toBe(
      payload(primera.refreshToken).jti,
    );
    await renovar(primera.refreshToken).expect(200);
  });

  it('un refreshToken viejo (fuera de la ventana) cierra la sesión: alguien lo copió', async () => {
    const tienda = await crearTienda(app);
    const nueva = (await renovar(tienda.refreshToken).expect(200))
      .body as Sesion;
    // Como si la rotación hubiera sido hace 5 minutos.
    await db.query(
      `UPDATE sesiones SET rotada_en = now() - interval '5 minutes' WHERE id = $1`,
      [payload(tienda.refreshToken).sid],
    );

    const robado = await renovar(tienda.refreshToken).expect(401);
    expect(mensaje(robado)).toMatch(/por seguridad/i);
    // La sesión entera quedó cerrada: ni el dueño ni el ladrón siguen.
    await renovar(nueva.refreshToken).expect(401);
    await perfil(nueva.accessToken).expect(401);
  });

  it('cerrar sesión corta el accessToken y el refreshToken al instante', async () => {
    const tienda = await crearTienda(app);
    await cliente(app)
      .post('/auth/logout', { refreshToken: tienda.refreshToken })
      .expect(204);
    await perfil(tienda.accessToken).expect(401);
    await renovar(tienda.refreshToken).expect(401);
  });

  it('cerrar sesión en un dispositivo no cierra los otros', async () => {
    const tienda = await crearTienda(app);
    const otroDispositivo = (
      await cliente(app)
        .post('/auth/login', { email: tienda.email, password: CLAVE })
        .expect(200)
    ).body as Sesion;
    await cliente(app)
      .post('/auth/logout', { refreshToken: tienda.refreshToken })
      .expect(204);
    await perfil(otroDispositivo.accessToken).expect(200);
    await renovar(otroDispositivo.refreshToken).expect(200);
  });

  it('logout con un token inválido responde 204 igual', async () => {
    await cliente(app)
      .post('/auth/logout', { refreshToken: 'no-es-un-token' })
      .expect(204);
  });

  it('desactivar a un cajero corta su acceso al instante, y reactivarlo no revive sus tokens', async () => {
    const tienda = await crearTienda(app);
    const cajero = await crearCajero(app, tienda.accessToken);
    await perfil(cajero.accessToken).expect(200);

    await cliente(app, tienda.accessToken)
      .patch(`/usuarios/${cajero.id}/desactivar`)
      .expect(200);
    await perfil(cajero.accessToken).expect(401);
    await renovar(cajero.refreshToken).expect(401);

    await cliente(app, tienda.accessToken)
      .patch(`/usuarios/${cajero.id}/reactivar`)
      .expect(200);
    await perfil(cajero.accessToken).expect(401);
    await renovar(cajero.refreshToken).expect(401);
    // Con su contraseña vuelve a entrar.
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .expect(200);
  });

  it('cambiarle la contraseña a un cajero cierra sus sesiones', async () => {
    const tienda = await crearTienda(app);
    const cajero = await crearCajero(app, tienda.accessToken);
    await cliente(app, tienda.accessToken)
      .patch(`/usuarios/${cajero.id}/password`, { password: 'nueva-clave-123' })
      .expect(200);
    await perfil(cajero.accessToken).expect(401);
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .expect(401);
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: 'nueva-clave-123' })
      .expect(200);
  });

  it('un token sin sesión (emitido antes de las sesiones) no sirve', async () => {
    const tienda = await crearTienda(app);
    const { sub, tenantId, rol } = JSON.parse(
      Buffer.from(tienda.accessToken.split('.')[1], 'base64url').toString(),
    ) as { sub: string; tenantId: string; rol: string };
    const config = app.get(ConfigService);
    const jwt = app.get(JwtService);
    const viejo = jwt.sign(
      { sub, tenantId, rol },
      { secret: config.get<string>('jwt.accessSecret'), expiresIn: 900 },
    );
    await perfil(viejo).expect(401);
    const refreshViejo = jwt.sign(
      { sub, tenantId, rol },
      { secret: config.get<string>('jwt.refreshSecret'), expiresIn: 900 },
    );
    await renovar(refreshViejo).expect(401);
  });

  it('un refreshToken firmado con otra clave no sirve', async () => {
    const tienda = await crearTienda(app);
    const jwt = app.get(JwtService);
    // Mismo contenido que el verdadero (misma sesión y jti vigente),
    // firmado con otra clave.
    const { sub, tenantId, rol, sid, jti } = JSON.parse(
      Buffer.from(tienda.refreshToken.split('.')[1], 'base64url').toString(),
    ) as Record<string, string>;
    const falso = jwt.sign(
      { sub, tenantId, rol, sid },
      { secret: 'otra-clave', jwtid: jti, expiresIn: 900 },
    );
    await renovar(falso).expect(401);
  });

  it('el accessToken no sirve como refreshToken (y al revés)', async () => {
    const tienda = await crearTienda(app);
    await renovar(tienda.accessToken).expect(401);
    await perfil(tienda.refreshToken).expect(401);
  });
});
