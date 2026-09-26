import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { MailService } from '../src/modules/mail/mail.service';
import {
  codigoDelPaso,
  deBase32,
  pasoActual,
} from '../src/common/seguridad/totp';
import {
  CLAVE,
  cliente,
  crearApp,
  crearCajero,
  crearTienda,
} from './utilidades';

interface Desafio {
  requiereCodigo: true;
  desafio: string;
}
interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** El código que mostraría la app autenticadora (en el paso actual + corrimiento). */
const codigoDe = (secreto: string, corrimiento = 0) =>
  codigoDelPaso(deBase32(secreto), pasoActual() + corrimiento);

describe('Verificación en dos pasos (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Una cuenta con la verificación ya activada. */
  async function cuentaConDosPasos() {
    const tienda = await crearTienda(app);
    const token = tienda.accessToken;
    const { secreto } = (
      await cliente(app, token).post('/auth/dos-pasos/iniciar').expect(200)
    ).body as { secreto: string; enlace: string };
    const { codigosRecuperacion } = (
      await cliente(app, token)
        .post('/auth/dos-pasos/activar', { codigo: codigoDe(secreto) })
        .expect(200)
    ).body as { codigosRecuperacion: string[] };
    const ingresar = async () =>
      (
        await cliente(app)
          .post('/auth/login', { email: tienda.email, password: CLAVE })
          .expect(200)
      ).body as Desafio;
    const conCodigo = (desafio: string, codigo: string) =>
      cliente(app).post('/auth/login/codigo', { desafio, codigo });
    return { tienda, token, secreto, codigosRecuperacion, ingresar, conCodigo };
  }

  it('se activa escaneando y confirmando un código', async () => {
    const { accessToken, email } = await crearTienda(app);
    const http = cliente(app, accessToken);

    expect((await http.get('/auth/dos-pasos').expect(200)).body).toMatchObject({
      activa: false,
    });
    const { secreto, enlace } = (
      await http.post('/auth/dos-pasos/iniciar').expect(200)
    ).body as { secreto: string; enlace: string };
    expect(secreto.replace(/ /g, '')).toMatch(/^[A-Z2-7]{32}$/);
    expect(enlace).toContain(encodeURIComponent(email));

    // Un código equivocado no la activa.
    await http
      .post('/auth/dos-pasos/activar', { codigo: '000000' })
      .expect(400);

    const { codigosRecuperacion } = (
      await http
        .post('/auth/dos-pasos/activar', { codigo: codigoDe(secreto) })
        .expect(200)
    ).body as { codigosRecuperacion: string[] };
    expect(codigosRecuperacion).toHaveLength(8);
    expect(codigosRecuperacion[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    const perfil = (await http.get('/auth/perfil').expect(200)).body as {
      dosPasos: boolean;
    };
    expect(perfil.dosPasos).toBe(true);
    expect((await http.get('/auth/dos-pasos').expect(200)).body).toMatchObject({
      activa: true,
      codigosRestantes: 8,
    });
    // Ni el secreto ni los códigos viajan en ninguna respuesta.
    expect(JSON.stringify(perfil)).not.toContain(secreto.replace(/ /g, ''));
  });

  it('con la contraseña sola no entra: pide el código', async () => {
    const { ingresar, conCodigo, secreto } = await cuentaConDosPasos();
    const paso1 = await ingresar();
    expect(paso1.requiereCodigo).toBe(true);
    expect(paso1).not.toHaveProperty('accessToken');

    await conCodigo(paso1.desafio, '000000').expect(401);
    // El código de este momento (el de la activación ya se usó: sirve el siguiente).
    const tokens = (
      await conCodigo(paso1.desafio, codigoDe(secreto, 1)).expect(200)
    ).body as Tokens;
    await cliente(app, tokens.accessToken).get('/auth/perfil').expect(200);
  });

  it('un código ya usado no sirve otra vez', async () => {
    const { ingresar, conCodigo, secreto } = await cuentaConDosPasos();
    const codigo = codigoDe(secreto, 1);
    await conCodigo((await ingresar()).desafio, codigo).expect(200);
    await conCodigo((await ingresar()).desafio, codigo).expect(401);
  });

  it('dos pedidos simultáneos con el mismo código: entra uno solo', async () => {
    const { ingresar, conCodigo, secreto } = await cuentaConDosPasos();
    const codigo = codigoDe(secreto, 1);
    const [a, b] = await Promise.all([
      ingresar().then((d) => conCodigo(d.desafio, codigo)),
      ingresar().then((d) => conCodigo(d.desafio, codigo)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it('cada código de recuperación sirve una vez', async () => {
    const { ingresar, conCodigo, codigosRecuperacion, token } =
      await cuentaConDosPasos();
    // En mayúsculas y sin guion también vale.
    const codigo = codigosRecuperacion[0].toUpperCase().replace('-', ' ');
    await conCodigo((await ingresar()).desafio, codigo).expect(200);
    await conCodigo((await ingresar()).desafio, codigo).expect(401);
    expect(
      (await cliente(app, token).get('/auth/dos-pasos').expect(200)).body,
    ).toMatchObject({ codigosRestantes: 7 });
  });

  it('probar códigos a ciegas bloquea la cuenta (y la contraseña no la desbloquea)', async () => {
    const { ingresar, conCodigo, secreto, tienda } = await cuentaConDosPasos();
    // Un desafío pedido antes del bloqueo (sigue vigente 5 minutos).
    const guardado = (await ingresar()).desafio;
    for (let i = 0; i < 5; i++) {
      // Volver a poner la contraseña no reinicia el contador.
      await conCodigo((await ingresar()).desafio, '000000').expect(401);
    }
    // Bloqueada: ni la contraseña ni el código bueno.
    await cliente(app)
      .post('/auth/login', { email: tienda.email, password: CLAVE })
      .expect(429);
    await conCodigo(guardado, codigoDe(secreto, 1)).expect(429);
  });

  it('el desafío no sirve como token de acceso, ni vencido o inventado', async () => {
    const { ingresar, conCodigo, secreto } = await cuentaConDosPasos();
    const { desafio } = await ingresar();
    await cliente(app, desafio).get('/auth/perfil').expect(401);
    await conCodigo(`${desafio}x`, codigoDe(secreto, 1)).expect(401);
  });

  it('se desactiva con un código, y después entra solo con la contraseña', async () => {
    const { token, secreto, tienda } = await cuentaConDosPasos();
    const http = cliente(app, token);
    await http
      .post('/auth/dos-pasos/desactivar', { codigo: '000000' })
      .expect(400);
    await http
      .post('/auth/dos-pasos/desactivar', { codigo: codigoDe(secreto, 1) })
      .expect(204);
    const login = (
      await cliente(app)
        .post('/auth/login', { email: tienda.email, password: CLAVE })
        .expect(200)
    ).body as Tokens;
    expect(login.accessToken).toBeDefined();
  });

  it('el admin se la quita a alguien del equipo, no a sí mismo, y queda registrado', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    const { secreto } = (
      await cliente(app, cajero.accessToken)
        .post('/auth/dos-pasos/iniciar')
        .expect(200)
    ).body as { secreto: string };
    await cliente(app, cajero.accessToken)
      .post('/auth/dos-pasos/activar', { codigo: codigoDe(secreto) })
      .expect(200);

    const lista = (await cliente(app, admin).get('/usuarios').expect(200))
      .body as { id: string; dosPasos: boolean }[];
    expect(lista.find((u) => u.id === cajero.id)?.dosPasos).toBe(true);

    const quitado = (
      await cliente(app, admin)
        .patch(`/usuarios/${cajero.id}/dos-pasos/quitar`)
        .expect(200)
    ).body as { dosPasos: boolean };
    expect(quitado.dosPasos).toBe(false);

    const yo = lista.find((u) => u.id !== cajero.id)!;
    await cliente(app, admin)
      .patch(`/usuarios/${yo.id}/dos-pasos/quitar`)
      .expect(400);
    // El cajero no puede quitársela a nadie.
    await cliente(app, cajero.accessToken)
      .patch(`/usuarios/${yo.id}/dos-pasos/quitar`)
      .expect(403);

    const actividad = (
      await cliente(app, admin)
        .get(`/usuarios/${cajero.id}/actividad`)
        .expect(200)
    ).body as { eventos: { tipo: string }[] };
    const tipos = actividad.eventos.map((e) => e.tipo);
    expect(tipos).toContain('dos_pasos_activada');
    expect(tipos).toContain('dos_pasos_quitada_por_admin');
  });
  it('un desafío de antes de cerrar todas las sesiones ya no sirve', async () => {
    const { token, secreto, ingresar, conCodigo } = await cuentaConDosPasos();
    const { desafio } = await ingresar();
    await cliente(app, token).post('/auth/cerrar-sesiones').expect(204);
    await conCodigo(desafio, codigoDe(secreto, 1)).expect(401);
  });

  it('un desafío de antes de restablecer la contraseña ya no sirve', async () => {
    const correos: { destinatarios: string[]; html: string }[] = [];
    const espia = jest
      .spyOn(app.get(MailService), 'enviar')
      .mockImplementation((c) => {
        correos.push(c);
        return Promise.resolve();
      });
    const { tienda, codigosRecuperacion, ingresar, conCodigo } =
      await cuentaConDosPasos();
    const { desafio } = await ingresar();

    await cliente(app)
      .post('/auth/olvide-password', { email: tienda.email })
      .expect(204);
    const enlace = /restablecer\?token=([\w-]+)/.exec(
      correos.find((c) => c.destinatarios.includes(tienda.email))!.html,
    )![1];
    await cliente(app)
      .post('/auth/restablecer-password', {
        token: enlace,
        password: 'otra-clave-segura-2026',
      })
      .expect(204);
    espia.mockRestore();

    // Con el código de recuperación (válido) y el desafío viejo: no.
    await conCodigo(desafio, codigosRecuperacion[0]).expect(401);
  });
  it('con una sesión robada no se pueden probar códigos sin fin para apagarla', async () => {
    const { tienda, token } = await cuentaConDosPasos();
    const apagar = (codigo: string) =>
      cliente(app, token).post('/auth/dos-pasos/desactivar', { codigo });

    for (let i = 0; i < 4; i++) await apagar('000000').expect(400);
    // Al quinto: la cuenta se bloquea y esa sesión deja de servir.
    const res = await apagar('000000').expect(429);
    expect((res.body as { message: string }).message).toMatch(
      /cerramos la sesión/,
    );
    await cliente(app, token).get('/auth/perfil').expect(401);
    await cliente(app)
      .post('/auth/login', { email: tienda.email, password: CLAVE })
      .expect(429);
    // Sigue activa.
    const [fila] = await app
      .get(DataSource)
      .query<{ activa: boolean }[]>(
        `SELECT dos_pasos_activo_desde IS NOT NULL AS activa FROM usuarios WHERE email = $1`,
        [tienda.email],
      );
    expect(fila.activa).toBe(true);
  });
});
