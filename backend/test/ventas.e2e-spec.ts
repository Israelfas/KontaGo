import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import {
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
  fechaEnDias,
} from './utilidades';

interface Producto {
  id: string;
  stock: number;
  fechaVencimiento: string | null;
  lotes: { id: string; fechaVencimiento: string | null; cantidad: number }[];
}
interface Venta {
  id: string;
  totalCentavos: number;
  ivaCentavos: number;
  vueltoCentavos: number;
  items: { id: string; productoId: string }[];
}

describe('Ventas, anulaciones y lotes', () => {
  let app: NestExpressApplication;
  let admin: string;
  let cajero: string;

  beforeAll(async () => {
    app = await crearApp();
    admin = (await crearTienda(app)).accessToken;
    cajero = (await crearCajero(app, admin)).accessToken;
  });
  afterAll(() => app.close());

  async function producto(id: string): Promise<Producto> {
    const lista = await cliente(app, admin).get('/productos').expect(200);
    return (lista.body as Producto[]).find((p) => p.id === id)!;
  }
  const vender = (
    token: string,
    items: { productoId: string; cantidad: number }[],
    montoRecibidoCentavos = 100_000,
  ) => cliente(app, token).post('/ventas', { items, montoRecibidoCentavos });

  it('una venta descuenta stock, calcula el vuelto y el IVA incluido', async () => {
    const p = await crearProducto(app, admin, {
      precioVentaCentavos: 115,
      stockInicial: 10,
    });
    const res = await vender(cajero, [{ productoId: p.id, cantidad: 2 }], 500);
    expect(res.status).toBe(201);
    const venta = res.body as Venta;
    expect(venta.totalCentavos).toBe(230);
    expect(venta.vueltoCentavos).toBe(270);
    expect(venta.ivaCentavos).toBe(30); // 15% incluido en $2,30
    expect((await producto(p.id)).stock).toBe(8);
  });

  it('un producto exento no lleva IVA', async () => {
    const p = await crearProducto(app, admin, {
      precioVentaCentavos: 100,
      ivaExento: true,
    });
    const venta = (await vender(cajero, [{ productoId: p.id, cantidad: 1 }]))
      .body as Venta;
    expect(venta.ivaCentavos).toBe(0);
  });

  it('sin stock suficiente no se vende nada (ni las otras líneas)', async () => {
    const hay = await crearProducto(app, admin, { stockInicial: 10 });
    const poco = await crearProducto(app, admin, { stockInicial: 1 });
    await vender(cajero, [
      { productoId: hay.id, cantidad: 3 },
      { productoId: poco.id, cantidad: 2 },
    ]).expect(400);
    expect((await producto(hay.id)).stock).toBe(10);
    expect((await producto(poco.id)).stock).toBe(1);
  });

  it('si el monto recibido no alcanza, no se registra la venta', async () => {
    const p = await crearProducto(app, admin, {
      precioVentaCentavos: 300,
      stockInicial: 5,
    });
    await vender(cajero, [{ productoId: p.id, cantidad: 1 }], 200).expect(400);
    expect((await producto(p.id)).stock).toBe(5);
  });

  it('un producto dado de baja no se puede vender', async () => {
    const p = await crearProducto(app, admin);
    await cliente(app, admin).patch(`/productos/${p.id}/baja`).expect(200);
    await vender(cajero, [{ productoId: p.id, cantidad: 1 }]).expect(404);
  });

  it('ventas simultáneas nunca venden más de lo que hay', async () => {
    const p = await crearProducto(app, admin, { stockInicial: 5 });
    const intentos = await Promise.all(
      Array.from({ length: 12 }, () =>
        vender(cajero, [{ productoId: p.id, cantidad: 1 }]),
      ),
    );
    const vendidas = intentos.filter((r) => r.status === 201).length;
    expect(vendidas).toBe(5);
    expect(intentos.every((r) => [201, 400].includes(r.status))).toBe(true);
    expect((await producto(p.id)).stock).toBe(0);
  });

  describe('anulaciones', () => {
    it('parcial y después total: devuelve stock y descuenta del resumen', async () => {
      const p = await crearProducto(app, admin, {
        precioVentaCentavos: 100,
        stockInicial: 10,
      });
      const venta = (await vender(cajero, [{ productoId: p.id, cantidad: 4 }]))
        .body as Venta;
      const antes = (await cliente(app, admin).get('/ventas/resumen')).body as {
        ingresoBrutoCentavos: number;
      };

      await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, {
          motivo: 'devolvió uno',
          items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }],
        })
        .expect(200);
      expect((await producto(p.id)).stock).toBe(7);

      const despues = (await cliente(app, admin).get('/ventas/resumen'))
        .body as { ingresoBrutoCentavos: number };
      expect(despues.ingresoBrutoCentavos).toBe(
        antes.ingresoBrutoCentavos - 100,
      );

      // Más de lo que queda sin anular → 400.
      await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, {
          motivo: 'de más',
          items: [{ ventaItemId: venta.items[0].id, cantidad: 4 }],
        })
        .expect(400);

      const total = await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, { motivo: 'se arrepintió' })
        .expect(200);
      expect((total.body as { estado: string }).estado).toBe('anulada');
      expect((await producto(p.id)).stock).toBe(10);

      // Ya anulada entera → 400.
      await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, { motivo: 'otra vez' })
        .expect(400);
    });

    it('el cajero no puede anular ni ver los números del dueño', async () => {
      const p = await crearProducto(app, admin);
      const venta = (await vender(cajero, [{ productoId: p.id, cantidad: 1 }]))
        .body as Venta;
      await cliente(app, cajero)
        .post(`/ventas/${venta.id}/anular`, { motivo: 'quiero' })
        .expect(403);
      await cliente(app, cajero).get('/ventas/resumen').expect(403);
      await cliente(app, cajero).get('/ventas').expect(403);
      await cliente(app, cajero).get('/inventario/resumen-dia').expect(403);
      await cliente(app, cajero).get('/ventas/hoy').expect(200);
    });

    it('una venta de otro día no se anula', async () => {
      const p = await crearProducto(app, admin);
      const venta = (await vender(cajero, [{ productoId: p.id, cantidad: 1 }]))
        .body as Venta;
      await app
        .get(DataSource)
        .query(
          `UPDATE ventas SET created_at = created_at - interval '2 days' WHERE id = $1`,
          [venta.id],
        );
      await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, { motivo: 'tarde' })
        .expect(400);
    });
  });

  describe('lotes', () => {
    it('vende primero lo que vence antes y la anulación lo devuelve a su lote', async () => {
      const p = await crearProducto(app, admin, {
        stockInicial: 3,
        fechaVencimiento: fechaEnDias(2),
      });
      await cliente(app, admin)
        .post('/inventario/abastecimiento', {
          productoId: p.id,
          cantidad: 5,
          costoUnitarioCentavos: 60,
          fechaVencimiento: fechaEnDias(20),
        })
        .expect(201);

      const venta = (await vender(cajero, [{ productoId: p.id, cantidad: 4 }]))
        .body as Venta;
      let actual = await producto(p.id);
      expect(actual.lotes.map((l) => [l.fechaVencimiento, l.cantidad])).toEqual(
        [[fechaEnDias(20), 4]],
      );
      expect(actual.fechaVencimiento).toBe(fechaEnDias(20));

      await cliente(app, admin)
        .post(`/ventas/${venta.id}/anular`, { motivo: 'devolución' })
        .expect(200);
      actual = await producto(p.id);
      expect(actual.lotes.map((l) => [l.fechaVencimiento, l.cantidad])).toEqual(
        [
          [fechaEnDias(2), 3],
          [fechaEnDias(20), 5],
        ],
      );
    });

    it('la corrección de lotes tiene que sumar el stock', async () => {
      const p = await crearProducto(app, admin, {
        stockInicial: 6,
        fechaVencimiento: fechaEnDias(5),
      });
      const lote = (await producto(p.id)).lotes[0];
      await cliente(app, admin)
        .put(`/inventario/productos/${p.id}/lotes`, {
          lotes: [
            { id: lote.id, fechaVencimiento: fechaEnDias(5), cantidad: 4 },
          ],
        })
        .expect(400);
      await cliente(app, admin)
        .put(`/inventario/productos/${p.id}/lotes`, {
          lotes: [
            { id: lote.id, fechaVencimiento: fechaEnDias(5), cantidad: 4 },
            { fechaVencimiento: fechaEnDias(-1), cantidad: 2 },
          ],
        })
        .expect(200);
      const alertas = await cliente(app, admin).get('/productos/alertas');
      expect(
        (alertas.body as { vencidos: { id: string }[] }).vencidos.map(
          (x) => x.id,
        ),
      ).toContain(p.id);
      await cliente(app, cajero)
        .put(`/inventario/productos/${p.id}/lotes`, { lotes: [] })
        .expect(403);
    });
  });

  describe('historial', () => {
    it('valida el rango de fechas', async () => {
      await cliente(app, admin)
        .get(
          `/ventas/resumen?desde=${fechaEnDias(-92)}&hasta=${fechaEnDias(0)}`,
        )
        .expect(400);
      await cliente(app, admin)
        .get(`/ventas/resumen?desde=${fechaEnDias(0)}&hasta=${fechaEnDias(-1)}`)
        .expect(400);
      await cliente(app, admin)
        .get('/ventas/resumen?desde=2026-02-30')
        .expect(400);
      await cliente(app, admin)
        .get(`/ventas/resumen?desde=${fechaEnDias(-6)}&hasta=${fechaEnDias(0)}`)
        .expect(200);
    });

    it('el listado se pagina sin repetir ventas', async () => {
      const p = await crearProducto(app, admin, { stockInicial: 50 });
      for (let i = 0; i < 5; i++) {
        await vender(cajero, [{ productoId: p.id, cantidad: 1 }]).expect(201);
      }
      const primera = await cliente(app, admin)
        .get('/ventas?limite=3')
        .expect(200);
      const segunda = await cliente(app, admin)
        .get('/ventas?limite=3&desplazamiento=3')
        .expect(200);
      type Pagina = { ventas: { id: string }[]; total: number };
      const p1 = primera.body as Pagina;
      const p2 = segunda.body as Pagina;
      const ids = [...p1.ventas, ...p2.ventas].map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(p1.total).toBeGreaterThanOrEqual(5);
    });
  });
});
