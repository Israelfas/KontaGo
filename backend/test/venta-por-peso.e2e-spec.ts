import { NestExpressApplication } from '@nestjs/platform-express';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearProducto,
  crearTienda,
} from './utilidades';

interface Producto {
  id: string;
  unidad: string;
  stock: number;
}
interface Venta {
  id: string;
  totalCentavos: number;
  items: { id: string; cantidad: number }[];
}

describe('Venta por peso', () => {
  let app: NestExpressApplication;
  let admin: string;

  beforeAll(async () => {
    app = await crearApp();
    admin = (await crearTienda(app)).accessToken;
    await abrirCaja(app, admin);
  });

  afterAll(() => app.close());

  const api = () => cliente(app, admin);
  const stockDe = async (id: string) =>
    ((await api().get('/productos').expect(200)).body as Producto[]).find(
      (p) => p.id === id,
    )!.stock;
  const vender = (productoId: string, cantidad: number) =>
    api().post('/ventas', {
      items: [{ productoId, cantidad }],
      metodoPago: 'transferencia',
    });

  it('se vende media libra de queso: importe al centavo y stock con decimales', async () => {
    const queso = await crearProducto(app, admin, {
      nombre: 'Queso fresco',
      unidad: 'libra',
      precioVentaCentavos: 325,
      costoUnitarioCentavos: 200,
      stockInicial: 10.5,
    });
    expect((queso as unknown as Producto).unidad).toBe('libra');
    expect(queso.stock).toBe(10.5);

    const venta = (await vender(queso.id, 0.5).expect(201)).body as Venta;
    // $3,25 × 0,5 = $1,625 → $1,63.
    expect(venta.totalCentavos).toBe(163);
    expect(venta.items[0].cantidad).toBe(0.5);
    expect(await stockDe(queso.id)).toBe(10);

    // Tres décimas (0,1 + 0,2 no se vuelve 0,30000000000000004).
    await vender(queso.id, 0.1).expect(201);
    await vender(queso.id, 0.2).expect(201);
    expect(await stockDe(queso.id)).toBe(9.7);
  });

  it('no se vende más peso del que hay', async () => {
    const arroz = await crearProducto(app, admin, {
      unidad: 'libra',
      stockInicial: 1.25,
    });
    await vender(arroz.id, 1.5).expect(400);
    await vender(arroz.id, 1.25).expect(201);
    expect(await stockDe(arroz.id)).toBe(0);
  });

  it('lo que va por unidad no acepta decimales; y más de 3 decimales, nadie', async () => {
    const coca = await crearProducto(app, admin, { stockInicial: 10 });
    const res = await vender(coca.id, 1.5).expect(400);
    expect((res.body as { message: string }).message).toMatch(/por unidad/);

    const azucar = await crearProducto(app, admin, {
      unidad: 'kilo',
      stockInicial: 5,
    });
    await vender(azucar.id, 0.0001).expect(400);
  });

  it('anular por partes devuelve justo lo cobrado', async () => {
    const jamon = await crearProducto(app, admin, {
      unidad: 'libra',
      precioVentaCentavos: 99,
      stockInicial: 3,
    });
    const venta = (await vender(jamon.id, 1).expect(201)).body as Venta;
    const itemId = venta.items[0].id;
    for (const cantidad of [0.333, 0.333, 0.334]) {
      await api()
        .post(`/ventas/${venta.id}/anular`, {
          motivo: 'devolvió',
          items: [{ ventaItemId: itemId, cantidad }],
        })
        .expect(200);
    }
    expect(await stockDe(jamon.id)).toBe(3);
    const hoy = (await api().get('/ventas/hoy').expect(200)).body as {
      id: string;
      totalAnuladoCentavos: number;
    }[];
    expect(hoy.find((v) => v.id === venta.id)!.totalAnuladoCentavos).toBe(99);
  });

  it('abastecer y registrar mermas con decimales', async () => {
    const harina = await crearProducto(app, admin, {
      unidad: 'libra',
      costoUnitarioCentavos: 50,
      stockInicial: 2,
    });
    await api()
      .post('/inventario/abastecimiento', {
        productoId: harina.id,
        cantidad: 2.25,
        costoUnitarioCentavos: 60,
      })
      .expect(201);
    await api()
      .post('/inventario/merma', {
        productoId: harina.id,
        cantidad: 0.25,
        motivo: 'danado',
      })
      .expect(201);
    expect(await stockDe(harina.id)).toBe(4);
  });

  it('pasar a "por unidad" solo si el stock es entero', async () => {
    const pan = await crearProducto(app, admin, {
      unidad: 'libra',
      stockInicial: 2.5,
    });
    await api().patch(`/productos/${pan.id}`, { unidad: 'unidad' }).expect(400);
    await vender(pan.id, 0.5).expect(201);
    const cambiado = (
      await api()
        .patch(`/productos/${pan.id}`, { unidad: 'unidad' })
        .expect(200)
    ).body as Producto;
    expect(cambiado.unidad).toBe('unidad');
  });
  it('partir la venta en líneas mínimas no baja el precio (se cobra el total una vez)', async () => {
    const arroz = await crearProducto(app, admin, {
      unidad: 'libra',
      precioVentaCentavos: 60,
      stockInicial: 20,
    });
    // 125 líneas de 0,008 lb: antes cada una se redondeaba a $0.
    const venta = (
      await api()
        .post('/ventas', {
          items: Array.from({ length: 125 }, () => ({
            productoId: arroz.id,
            cantidad: 0.008,
          })),
          metodoPago: 'transferencia',
        })
        .expect(201)
    ).body as Venta;
    expect(venta.totalCentavos).toBe(60);
    expect(venta.items).toHaveLength(1);
    expect(venta.items[0].cantidad).toBe(1);
    expect(await stockDe(arroz.id)).toBe(19);
  });

  it('una cantidad que no llega a un centavo no se vende', async () => {
    const arroz = await crearProducto(app, admin, {
      unidad: 'libra',
      precioVentaCentavos: 60,
      stockInicial: 5,
    });
    const res = await vender(arroz.id, 0.008).expect(400);
    expect((res.body as { message: string }).message).toMatch(/un centavo/);
    expect(await stockDe(arroz.id)).toBe(5);
  });

  it('una venta no puede traer más de 200 líneas', async () => {
    const p = await crearProducto(app, admin, { stockInicial: 1000 });
    await api()
      .post('/ventas', {
        items: Array.from({ length: 201 }, () => ({
          productoId: p.id,
          cantidad: 1,
        })),
        metodoPago: 'transferencia',
      })
      .expect(400);
  });
});
