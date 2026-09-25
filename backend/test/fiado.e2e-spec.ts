import { NestExpressApplication } from '@nestjs/platform-express';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

interface Cliente {
  id: string;
  nombre: string;
  saldoCentavos: number;
  movimientos?: { tipo: 'venta' | 'abono' }[];
}
interface Venta {
  id: string;
  totalCentavos: number;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  items: { id: string }[];
}

describe('Fiado', () => {
  let app: NestExpressApplication;
  let admin: string;
  let cajero: string;
  let producto: { id: string };

  beforeAll(async () => {
    app = await crearApp();
    admin = (await crearTienda(app)).accessToken;
    cajero = (await crearCajero(app, admin)).accessToken;
    await abrirCaja(app, cajero);
    producto = await crearProducto(app, admin, {
      precioVentaCentavos: 250,
      stockInicial: 100,
    });
  });

  afterAll(() => app.close());

  const nuevoCliente = async (nombre = 'Doña Rosa') =>
    (
      await cliente(app, cajero)
        .post('/clientes', { nombre, telefono: '099 123 4567' })
        .expect(201)
    ).body as Cliente;
  const fiar = (clienteId: string | undefined, cantidad = 2) =>
    cliente(app, cajero).post('/ventas', {
      items: [{ productoId: producto.id, cantidad }],
      metodoPago: 'fiado',
      clienteId,
    });
  const detalle = async (id: string) =>
    (await cliente(app, cajero).get(`/clientes/${id}`).expect(200))
      .body as Cliente;
  const caja = async () =>
    (
      (await cliente(app, cajero).get('/caja/actual').expect(200)).body as {
        turno: {
          ventasFiadoCentavos: number;
          ingresosCentavos: number;
        };
      }
    ).turno;

  it('vender al fiado: no entra al cajón y queda como deuda', async () => {
    const rosa = await nuevoCliente();
    const antes = await caja();

    const venta = (await fiar(rosa.id).expect(201)).body as Venta;
    expect(venta.totalCentavos).toBe(500);
    expect(venta.montoRecibidoCentavos).toBe(0);
    expect(venta.vueltoCentavos).toBe(0);

    expect((await detalle(rosa.id)).saldoCentavos).toBe(500);
    // Al cajón no entra nada (el cajero no ve lo esperado: cuenta a ciegas).
    const despues = await caja();
    expect(despues.ventasFiadoCentavos - antes.ventasFiadoCentavos).toBe(500);
    expect(despues.ingresosCentavos).toBe(antes.ingresosCentavos);
  });

  it('sin cliente, o con uno de otra tienda, no se fía', async () => {
    await fiar(undefined).expect(400);
    const otraTienda = (await crearTienda(app)).accessToken;
    const ajeno = (
      await cliente(app, otraTienda)
        .post('/clientes', { nombre: 'Ajeno' })
        .expect(201)
    ).body as Cliente;
    await fiar(ajeno.id).expect(404);
  });

  it('abonos: en efectivo entran a la caja; nunca más de lo que debe', async () => {
    const pedro = await nuevoCliente('Don Pedro');
    await fiar(pedro.id, 4).expect(201); // $10,00
    const antes = await caja();

    await cliente(app, cajero)
      .post(`/clientes/${pedro.id}/abonos`, {
        montoCentavos: 300,
        metodoPago: 'efectivo',
      })
      .expect(201);
    const despues = await caja();
    expect(despues.ingresosCentavos - antes.ingresosCentavos).toBe(300);

    const res = await cliente(app, cajero)
      .post(`/clientes/${pedro.id}/abonos`, {
        montoCentavos: 800,
        metodoPago: 'transferencia',
      })
      .expect(400);
    expect((res.body as { message: string }).message).toMatch(/más de lo que/);

    const saldado = (
      await cliente(app, cajero)
        .post(`/clientes/${pedro.id}/abonos`, {
          montoCentavos: 700,
          metodoPago: 'transferencia',
        })
        .expect(201)
    ).body as Cliente;
    expect(saldado.saldoCentavos).toBe(0);

    const historial = await detalle(pedro.id);
    expect(historial.movimientos!.map((m) => m.tipo).sort()).toEqual([
      'abono',
      'abono',
      'venta',
    ]);
  });

  it('dos abonos al mismo tiempo no pagan de más', async () => {
    const ana = await nuevoCliente('Ana');
    await fiar(ana.id, 2).expect(201); // $5,00
    const intentos = await Promise.all(
      [1, 2].map(() =>
        cliente(app, cajero).post(`/clientes/${ana.id}/abonos`, {
          montoCentavos: 400,
          metodoPago: 'transferencia',
        }),
      ),
    );
    expect(intentos.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await detalle(ana.id)).saldoCentavos).toBe(100);
  });

  it('anular una venta fiada baja la deuda; archivar solo sin deuda', async () => {
    const luis = await nuevoCliente('Luis');
    const venta = (await fiar(luis.id, 2).expect(201)).body as Venta;

    await cliente(app, admin)
      .patch(`/clientes/${luis.id}`, { activo: false })
      .expect(400);
    await cliente(app, admin)
      .post(`/ventas/${venta.id}/anular`, { motivo: 'no se llevó nada' })
      .expect(200);
    expect((await detalle(luis.id)).saldoCentavos).toBe(0);

    await cliente(app, cajero)
      .patch(`/clientes/${luis.id}`, { activo: false })
      .expect(403);
    await cliente(app, admin)
      .patch(`/clientes/${luis.id}`, { activo: false })
      .expect(200);
    const lista = (await cliente(app, cajero).get('/clientes').expect(200))
      .body as Cliente[];
    expect(lista.some((c) => c.id === luis.id)).toBe(false);
    await fiar(luis.id).expect(404);
  });

  it('el abono en efectivo pide la caja abierta', async () => {
    const otro = await crearCajero(app, admin);
    const eva = await nuevoCliente('Eva');
    await fiar(eva.id, 1).expect(201);
    const res = await cliente(app, otro.accessToken)
      .post(`/clientes/${eva.id}/abonos`, {
        montoCentavos: 100,
        metodoPago: 'efectivo',
      })
      .expect(400);
    expect((res.body as { message: string }).message).toMatch(/abre tu caja/);
  });
});
