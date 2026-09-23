import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { MailService } from '../src/modules/mail/mail.service';
import {
  CLAVE,
  cliente,
  crearApp,
  crearTienda,
  emailUnico,
} from './utilidades';

const mensaje = (res: { body: unknown }) =>
  JSON.stringify((res.body as { message: unknown }).message);

describe('Seguridad de acceso (ISO/IEC 27002: 5.17, 8.5, 8.15)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  let correos: { destinatarios: string[]; asunto: string; html: string }[];

  beforeAll(async () => {
    app = await crearApp();
    db = app.get(DataSource);
    // El enlace de recuperación solo viaja por email (en la base queda su
    // hash): se lo toma del email "enviado".
    correos = [];
    jest.spyOn(app.get(MailService), 'enviar').mockImplementation((c) => {
      correos.push(c);
      return Promise.resolve();
    });
  });
  afterAll(() => app.close());

  const enlaceDe = (email: string) => {
    const correo = [...correos]
      .reverse()
      .find((c) => c.destinatarios.includes(email));
    return /restablecer\?token=([\w-]+)/.exec(correo?.html ?? '')?.[1];
  };
  const eventos = async (email: string) =>
    (
      await db.query<{ tipo: string }[]>(
        `SELECT tipo FROM eventos_seguridad WHERE email = $1 ORDER BY created_at`,
        [email],
      )
    ).map((e) => e.tipo);

  describe('login', () => {
    it('los errores de validación llegan en español', async () => {
      const res = await cliente(app)
        .post('/auth/login', { email: 'no-es-email', password: 'x' })
        .expect(400);
      expect(mensaje(res)).toContain('Revisá el email');
      expect(mensaje(res)).not.toMatch(/must be/);
    });

    it('mismo mensaje exista o no el email (no revela qué cuentas hay)', async () => {
      const { email } = await crearTienda(app);
      const inexistente = await cliente(app)
        .post('/auth/login', {
          email: emailUnico('nadie'),
          password: 'otra-clave',
        })
        .expect(401);
      const equivocada = await cliente(app)
        .post('/auth/login', { email, password: 'otra-clave' })
        .expect(401);
      expect(mensaje(inexistente)).toBe(mensaje(equivocada));
      expect(mensaje(equivocada)).toContain('Email o contraseña incorrectos');
    });

    it('una contraseña de antes de la política (6 caracteres) sigue sirviendo', async () => {
      const { email } = await crearTienda(app);
      await db.query(
        `UPDATE usuarios SET password_hash = $1 WHERE email = $2`,
        [await bcrypt.hash('abc123', 10), email],
      );
      await cliente(app)
        .post('/auth/login', { email, password: 'abc123' })
        .expect(200);
    });

    it('al entrar, un hash con costo viejo se vuelve a cifrar con el nuevo', async () => {
      const { email } = await crearTienda(app);
      await db.query(
        `UPDATE usuarios SET password_hash = $1 WHERE email = $2`,
        [await bcrypt.hash(CLAVE, 10), email],
      );
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(200);
      const [{ password_hash }] = await db.query<{ password_hash: string }[]>(
        `SELECT password_hash FROM usuarios WHERE email = $1`,
        [email],
      );
      expect(bcrypt.getRounds(password_hash)).toBe(12);
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(200);
    });

    it('5 contraseñas equivocadas bloquean la cuenta 15 minutos, aun con la correcta', async () => {
      const { email } = await crearTienda(app);
      for (let i = 0; i < 5; i++) {
        await cliente(app)
          .post('/auth/login', { email, password: `mala-${i}-xx` })
          .expect(401);
      }
      const bloqueado = await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(429);
      expect(mensaje(bloqueado)).toMatch(
        /bloqueamos el ingreso por 1[45] minutos/,
      );
      const registro = await eventos(email);
      expect(registro.filter((t) => t === 'ingreso_fallido')).toHaveLength(5);
      expect(registro).toContain('cuenta_bloqueada');
      expect(registro).toContain('ingreso_bloqueado');
    });

    it('un ingreso correcto borra los intentos fallidos', async () => {
      const { email } = await crearTienda(app);
      for (let i = 0; i < 4; i++) {
        await cliente(app)
          .post('/auth/login', { email, password: `mala-${i}-xx` })
          .expect(401);
      }
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(200);
      for (let i = 0; i < 4; i++) {
        await cliente(app)
          .post('/auth/login', { email, password: `mala-${i}-xx` })
          .expect(401);
      }
      // Van 4 desde el último ingreso: todavía no se bloquea.
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(200);
    });

    it('registra el ingreso con IP y dispositivo', async () => {
      const { email } = await crearTienda(app);
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .set('User-Agent', 'Prueba/1.0')
        .expect(200);
      const [ev] = await db.query<{ ip: string; user_agent: string }[]>(
        `SELECT ip, user_agent FROM eventos_seguridad WHERE email = $1 AND tipo = 'ingreso'`,
        [email],
      );
      expect(ev.ip).toBeTruthy();
      expect(ev.user_agent).toBe('Prueba/1.0');
    });
  });

  describe('política de contraseñas y registro', () => {
    const registrar = (extra: object) =>
      cliente(app).post('/auth/registro', {
        nombreTienda: 'Tienda',
        nombreAdmin: 'Admin',
        email: emailUnico('politica'),
        password: 'una-frase-larga',
        aceptaTerminos: true,
        ...extra,
      });

    it('pide al menos 8 caracteres', async () => {
      const res = await registrar({ password: 'corta1' }).expect(400);
      expect(mensaje(res)).toContain('al menos 8 caracteres');
    });

    it('rechaza las más usadas', async () => {
      const res = await registrar({ password: '12345678' }).expect(400);
      expect(mensaje(res)).toContain('de las más usadas');
    });

    it('rechaza el propio email', async () => {
      const email = emailUnico('juanperez');
      const res = await registrar({
        email,
        password: email.split('@')[0],
      }).expect(400);
      expect(mensaje(res)).toContain('no puede ser tu email');
    });

    it('sin aceptar los términos no se crea la cuenta', async () => {
      const res = await registrar({ aceptaTerminos: false }).expect(400);
      expect(mensaje(res)).toContain('aceptar los términos');
      await registrar({ aceptaTerminos: undefined }).expect(400);
    });

    it('guarda cuándo se aceptaron los términos', async () => {
      const { email } = await crearTienda(app);
      const [{ terminos_aceptados_en }] = await db.query<
        { terminos_aceptados_en: Date | null }[]
      >(`SELECT terminos_aceptados_en FROM usuarios WHERE email = $1`, [email]);
      expect(terminos_aceptados_en).not.toBeNull();
    });

    it('el alta de un cajero también sigue la política', async () => {
      const { accessToken } = await crearTienda(app);
      await cliente(app, accessToken)
        .post('/usuarios', {
          nombre: 'Cajero',
          email: emailUnico('cajero'),
          password: 'password',
        })
        .expect(400);
    });
  });

  describe('recuperar la contraseña', () => {
    it('responde igual exista o no el email, y solo a la cuenta real le manda el enlace', async () => {
      const { email } = await crearTienda(app);
      const nadie = emailUnico('nadie');
      await cliente(app)
        .post('/auth/olvide-password', { email: nadie })
        .expect(204);
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      expect(enlaceDe(nadie)).toBeUndefined();
      expect(enlaceDe(email)).toMatch(/^[\w-]{40,}$/);
    });

    it('con el enlace se elige otra contraseña; se cierran las sesiones y se avisa por email', async () => {
      const { email, accessToken } = await crearTienda(app);
      await cliente(app)
        .post('/auth/olvide-password', { email: email.toUpperCase() })
        .expect(204);
      const token = enlaceDe(email)!;

      await cliente(app)
        .post('/auth/restablecer-password/verificar', { token })
        .expect(204);
      const debil = await cliente(app)
        .post('/auth/restablecer-password', { token, password: 'password' })
        .expect(400);
      expect(mensaje(debil)).toContain('de las más usadas');

      await cliente(app)
        .post('/auth/restablecer-password', {
          token,
          password: 'otra-frase-segura',
        })
        .expect(204);

      // La sesión de antes deja de servir; la contraseña vieja también.
      await cliente(app, accessToken).get('/auth/perfil').expect(401);
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(401);
      await cliente(app)
        .post('/auth/login', { email, password: 'otra-frase-segura' })
        .expect(200);

      const aviso = correos.find(
        (c) =>
          c.destinatarios.includes(email) &&
          /contraseña de KontaGo cambió/.test(c.asunto),
      );
      expect(aviso).toBeDefined();
      expect(await eventos(email)).toEqual(
        expect.arrayContaining([
          'recuperacion_pedida',
          'password_restablecida',
        ]),
      );
    });

    it('el enlace sirve una sola vez', async () => {
      const { email } = await crearTienda(app);
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      const token = enlaceDe(email)!;
      await cliente(app)
        .post('/auth/restablecer-password', {
          token,
          password: 'primera-frase-ok',
        })
        .expect(204);
      const otraVez = await cliente(app)
        .post('/auth/restablecer-password', {
          token,
          password: 'segunda-frase-ok',
        })
        .expect(400);
      expect(mensaje(otraVez)).toContain('venció o ya se usó');
    });

    it('un enlace vencido no sirve', async () => {
      const { email } = await crearTienda(app);
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      const token = enlaceDe(email)!;
      await db.query(
        `UPDATE recuperaciones_password SET expira_en = now() - interval '1 minute'
         WHERE usuario_id = (SELECT id FROM usuarios WHERE email = $1)`,
        [email],
      );
      await cliente(app)
        .post('/auth/restablecer-password/verificar', { token })
        .expect(400);
    });

    it('un enlace nuevo anula el anterior', async () => {
      const { email } = await crearTienda(app);
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      const viejo = enlaceDe(email)!;
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      const nuevo = enlaceDe(email)!;
      expect(nuevo).not.toBe(viejo);
      await cliente(app)
        .post('/auth/restablecer-password/verificar', { token: viejo })
        .expect(400);
      await cliente(app)
        .post('/auth/restablecer-password/verificar', { token: nuevo })
        .expect(204);
    });

    it('como mucho 3 enlaces por hora por cuenta', async () => {
      const { email } = await crearTienda(app);
      for (let i = 0; i < 5; i++) {
        await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      }
      const [{ n }] = await db.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM recuperaciones_password
         WHERE usuario_id = (SELECT id FROM usuarios WHERE email = $1)`,
        [email],
      );
      expect(n).toBe(3);
    });

    it('recuperar la contraseña desbloquea la cuenta', async () => {
      const { email } = await crearTienda(app);
      for (let i = 0; i < 5; i++) {
        await cliente(app)
          .post('/auth/login', { email, password: `mala-${i}-xx` })
          .expect(401);
      }
      await cliente(app)
        .post('/auth/login', { email, password: CLAVE })
        .expect(429);
      await cliente(app).post('/auth/olvide-password', { email }).expect(204);
      await cliente(app)
        .post('/auth/restablecer-password', {
          token: enlaceDe(email),
          password: 'frase-nueva-larga',
        })
        .expect(204);
      await cliente(app)
        .post('/auth/login', { email, password: 'frase-nueva-larga' })
        .expect(200);
    });
  });

  it('encabezados de seguridad, y /auth sin caché', async () => {
    const res = await cliente(app)
      .post('/auth/login', { email: emailUnico('x'), password: 'x' })
      .expect(401);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
