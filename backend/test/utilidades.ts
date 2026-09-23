import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

/**
 * La app completa, configurada igual que en main.ts, contra la base de
 * tests. Solo se apaga el límite de intentos de /auth: los tests hacen
 * muchos logins seguidos desde la misma IP.
 */
export async function crearApp(): Promise<NestExpressApplication> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  return app;
}

export const CLAVE = 'clave-de-prueba';

export interface Sesion {
  accessToken: string;
  refreshToken: string;
}

/** Cliente HTTP con (o sin) sesión. */
export function cliente(app: NestExpressApplication, token?: string) {
  const http = app.getHttpServer() as App;
  const conToken = (r: request.Test) =>
    token ? r.set('Authorization', `Bearer ${token}`) : r;
  return {
    get: (ruta: string) => conToken(request(http).get(ruta)),
    post: (ruta: string, body?: object) =>
      conToken(request(http).post(ruta)).send(body ?? {}),
    patch: (ruta: string, body?: object) =>
      conToken(request(http).patch(ruta)).send(body ?? {}),
    put: (ruta: string, body?: object) =>
      conToken(request(http).put(ruta)).send(body ?? {}),
  };
}

/** Email que no choca con el de otro test (el email es único en la plataforma). */
export function emailUnico(prefijo: string): string {
  return `${prefijo}-${randomUUID().slice(0, 8)}@prueba.test`;
}

/** Una tienda nueva con su admin. */
export async function crearTienda(
  app: NestExpressApplication,
  nombre = 'Tienda de prueba',
): Promise<Sesion & { email: string }> {
  const email = emailUnico('admin');
  const res = await cliente(app)
    .post('/auth/registro', {
      nombreTienda: nombre,
      nombreAdmin: 'Admin',
      email,
      password: CLAVE,
    })
    .expect(201);
  return { ...(res.body as Sesion), email };
}

/** Un cajero de la tienda del admin, ya logueado. */
export async function crearCajero(
  app: NestExpressApplication,
  tokenAdmin: string,
): Promise<Sesion & { id: string; email: string }> {
  const email = emailUnico('cajero');
  const alta = await cliente(app, tokenAdmin)
    .post('/usuarios', { nombre: 'Cajero', email, password: CLAVE })
    .expect(201);
  const login = await cliente(app)
    .post('/auth/login', { email, password: CLAVE })
    .expect(200);
  const { id } = alta.body as { id: string };
  return { ...(login.body as Sesion), id, email };
}

let siguienteCodigo = 0;

/** Un producto con stock (código de barras único dentro del archivo). */
export async function crearProducto(
  app: NestExpressApplication,
  tokenAdmin: string,
  datos: Record<string, unknown> = {},
): Promise<{ id: string; codigoBarras: string; stock: number }> {
  siguienteCodigo++;
  const res = await cliente(app, tokenAdmin)
    .post('/productos', {
      codigoBarras: `7800000${String(siguienteCodigo).padStart(6, '0')}`,
      nombre: `Producto ${siguienteCodigo}`,
      precioVentaCentavos: 115,
      costoUnitarioCentavos: 60,
      stockInicial: 10,
      ...datos,
    })
    .expect(201);
  return res.body as { id: string; codigoBarras: string; stock: number };
}

/** 'AAAA-MM-DD' de hoy + N días (hora local, igual que el backend). */
export function fechaEnDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
