import { NestExpressApplication } from '@nestjs/platform-express';
import {
  CLAVE,
  cliente,
  crearApp,
  crearCajero,
  crearTienda,
} from './utilidades';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

interface Actividad {
  sesiones: {
    id: string;
    dispositivo: string;
    ip: string | null;
    esEsta: boolean;
  }[];
  eventos: { tipo: string; dispositivo: string | null }[];
}
interface Persona {
  id: string;
  email: string;
  ultimoIngreso: string | null;
  bloqueadoHasta: string | null;
}

describe('Actividad de seguridad del equipo (ISO/IEC 27002: 8.15, 8.16)', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await crearApp();
  });
  afterAll(() => app.close());

  it('muestra dónde tiene la sesión abierta cada persona, en palabras', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .set('User-Agent', CHROME_WINDOWS)
      .expect(200);
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .set('User-Agent', 'okhttp/4.12.0')
      .expect(200);

    const body: unknown = (
      await cliente(app, admin)
        .get(`/usuarios/${cajero.id}/actividad`)
        .expect(200)
    ).body;
    const actividad = body as Actividad;
    const dispositivos = actividad.sesiones.map((s) => s.dispositivo);
    expect(dispositivos).toEqual(
      expect.arrayContaining(['Chrome en Windows', 'App en Android']),
    );
    expect(actividad.eventos.map((e) => e.tipo)).toContain('ingreso');
  });

  it('marca la sesión desde la que se consulta', async () => {
    const tienda = await crearTienda(app);
    const equipo: unknown = (
      await cliente(app, tienda.accessToken).get('/usuarios').expect(200)
    ).body;
    const yo = (equipo as Persona[])[0];
    const body: unknown = (
      await cliente(app, tienda.accessToken)
        .get(`/usuarios/${yo.id}/actividad`)
        .expect(200)
    ).body;
    expect((body as Actividad).sesiones.filter((s) => s.esEsta)).toHaveLength(
      1,
    );
  });

  it('la lista del equipo trae el último ingreso', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    const body: unknown = (
      await cliente(app, admin).get('/usuarios').expect(200)
    ).body;
    const persona = (body as Persona[]).find((p) => p.id === cajero.id)!;
    expect(persona.ultimoIngreso).not.toBeNull();
  });

  it('el admin cierra las sesiones de alguien del equipo', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    await cliente(app, cajero.accessToken).get('/auth/perfil').expect(200);
    await cliente(app, admin)
      .post(`/usuarios/${cajero.id}/cerrar-sesiones`)
      .expect(204);
    await cliente(app, cajero.accessToken).get('/auth/perfil').expect(401);
    const body: unknown = (
      await cliente(app, admin)
        .get(`/usuarios/${cajero.id}/actividad`)
        .expect(200)
    ).body;
    expect((body as Actividad).sesiones).toHaveLength(0);
    expect((body as Actividad).eventos.map((e) => e.tipo)).toContain(
      'sesiones_cerradas',
    );
  });

  it('cada uno cierra sus propias sesiones en todos los dispositivos', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    const otroDispositivo = await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .expect(200);
    await cliente(app, cajero.accessToken)
      .post('/auth/cerrar-sesiones')
      .expect(204);
    await cliente(app, cajero.accessToken).get('/auth/perfil').expect(401);
    await cliente(
      app,
      (otroDispositivo.body as { accessToken: string }).accessToken,
    )
      .get('/auth/perfil')
      .expect(401);
  });

  it('el admin desbloquea una cuenta bloqueada por intentos fallidos', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    for (let i = 0; i < 5; i++) {
      await cliente(app)
        .post('/auth/login', { email: cajero.email, password: `mala-${i}-xx` })
        .expect(401);
    }
    const equipo: unknown = (
      await cliente(app, admin).get('/usuarios').expect(200)
    ).body;
    expect(
      (equipo as Persona[]).find((p) => p.id === cajero.id)!.bloqueadoHasta,
    ).not.toBeNull();

    const body: unknown = (
      await cliente(app, admin)
        .patch(`/usuarios/${cajero.id}/desbloquear`)
        .expect(200)
    ).body;
    expect((body as Persona).bloqueadoHasta).toBeNull();
    await cliente(app)
      .post('/auth/login', { email: cajero.email, password: CLAVE })
      .expect(200);
  });

  it('un cajero no ve la actividad; otra tienda no ve la de esta', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    await cliente(app, cajero.accessToken)
      .get(`/usuarios/${cajero.id}/actividad`)
      .expect(403);
    const { accessToken: otra } = await crearTienda(app);
    await cliente(app, otra)
      .get(`/usuarios/${cajero.id}/actividad`)
      .expect(404);
    await cliente(app, otra)
      .post(`/usuarios/${cajero.id}/cerrar-sesiones`)
      .expect(404);
  });
});
