import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

interface Venta {
  id: string;
  numero: number;
  totalCentavos: number;
  createdAt: string;
}

/**
 * Ventas cobradas sin conexión: la app las manda después, con una clave
 * propia y la hora en que se cobraron.
 */
describe('Ventas sin conexión (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function escenario() {
    const admin = (await crearTienda(app)).accessToken;
    const cajero = await crearCajero(app, admin);
    const producto = await crearProducto(app, admin, {
      precioVentaCentavos: 115,
      stockInicial: 10,
    });
    await abrirCaja(app, cajero.accessToken);
    const vender = (extra: Record<string, unknown> = {}) =>
      cliente(app, cajero.accessToken).post('/ventas', {
        items: [{ productoId: producto.id, cantidad: 2 }],
        montoRecibidoCentavos: 500,
        ...extra,
      });
    const stock = async () => {
      const lista = (await cliente(app, admin).get('/productos').expect(200))
        .body as { id: string; stock: number }[];
      return lista.find((p) => p.id === producto.id)!.stock;
    };
    return { admin, cajero, vender, stock };
  }

  it('la misma venta mandada dos veces se cobra una sola vez', async () => {
    const { vender, stock } = await escenario();
    const clave = randomUUID();

    const primera = (await vender({ claveIdempotencia: clave }).expect(201))
      .body as Venta;
    const segunda = (await vender({ claveIdempotencia: clave }).expect(201))
      .body as Venta;

    expect(segunda.id).toBe(primera.id);
    expect(segunda.numero).toBe(primera.numero);
    expect(await stock()).toBe(8);
  });

  it('dos envíos simultáneos de la misma venta también', async () => {
    const { vender, stock } = await escenario();
    const clave = randomUUID();

    const [a, b] = await Promise.all([
      vender({ claveIdempotencia: clave }),
      vender({ claveIdempotencia: clave }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((a.body as Venta).id).toBe((b.body as Venta).id);
    expect(await stock()).toBe(8);
  });

  it('claves distintas son ventas distintas', async () => {
    const { vender, stock } = await escenario();
    await vender({ claveIdempotencia: randomUUID() }).expect(201);
    await vender({ claveIdempotencia: randomUUID() }).expect(201);
    expect(await stock()).toBe(6);
  });

  it('respeta la hora en que se cobró, dentro del turno', async () => {
    const { cajero, vender } = await escenario();
    const { turno } = (
      await cliente(app, cajero.accessToken).get('/caja/actual').expect(200)
    ).body as { turno: { abiertoEn: string } };
    const abiertoEn = new Date(turno.abiertoEn).getTime();
    await new Promise((r) => setTimeout(r, 1500));

    // Se cobró medio segundo después de abrir la caja y llega ahora.
    const cobrada = new Date(abiertoEn + 500).toISOString();
    const venta = (
      await vender({
        claveIdempotencia: randomUUID(),
        vendidaEn: cobrada,
      }).expect(201)
    ).body as Venta;
    expect(new Date(venta.createdAt).toISOString()).toBe(cobrada);

    // Un reloj atrasado no la saca del turno; uno adelantado no la manda al futuro.
    const antes = (
      await vender({
        claveIdempotencia: randomUUID(),
        vendidaEn: new Date(abiertoEn - 3_600_000).toISOString(),
      }).expect(201)
    ).body as Venta;
    expect(new Date(antes.createdAt).getTime()).toBe(abiertoEn);

    const futura = (
      await vender({
        claveIdempotencia: randomUUID(),
        vendidaEn: new Date(Date.now() + 3_600_000).toISOString(),
      }).expect(201)
    ).body as Venta;
    expect(new Date(futura.createdAt).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it('la clave es por tienda: otra tienda puede usar la misma', async () => {
    const clave = randomUUID();
    const a = await escenario();
    const b = await escenario();
    const ventaA = (await a.vender({ claveIdempotencia: clave }).expect(201))
      .body as Venta;
    const ventaB = (await b.vender({ claveIdempotencia: clave }).expect(201))
      .body as Venta;
    expect(ventaB.id).not.toBe(ventaA.id);
  });

  it('una clave que no es UUID o una fecha inválida se rechazan', async () => {
    const { vender } = await escenario();
    await vender({ claveIdempotencia: 'venta-1' }).expect(400);
    await vender({ claveIdempotencia: randomUUID(), vendidaEn: 'ayer' }).expect(
      400,
    );
  });
});
