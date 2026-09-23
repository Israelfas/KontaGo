import { NestExpressApplication } from '@nestjs/platform-express';
import {
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

/**
 * Aislamiento entre tiendas: la tienda B no puede ver ni tocar nada de la
 * tienda A, aunque adivine los ids. Es lo más grave que podría romperse
 * en una plataforma con muchas tiendas.
 */
describe('Aislamiento entre tiendas', () => {
  let app: NestExpressApplication;
  let tokenA: string;
  let tokenB: string;
  let productoA: { id: string; codigoBarras: string };
  let ventaA: { id: string; items: { id: string }[] };
  let cajeroA: { id: string };

  beforeAll(async () => {
    app = await crearApp();
    tokenA = (await crearTienda(app, 'Tienda A')).accessToken;
    tokenB = (await crearTienda(app, 'Tienda B')).accessToken;
    productoA = await crearProducto(app, tokenA, {
      stockInicial: 10,
      fechaVencimiento: '2099-01-01',
    });
    ventaA = (
      await cliente(app, tokenA)
        .post('/ventas', {
          items: [{ productoId: productoA.id, cantidad: 1 }],
          montoRecibidoCentavos: 500,
        })
        .expect(201)
    ).body as { id: string; items: { id: string }[] };
    cajeroA = await crearCajero(app, tokenA);
  });
  afterAll(() => app.close());

  const b = () => cliente(app, tokenB);

  it('no ve los productos de otra tienda', async () => {
    const lista = await b().get('/productos').expect(200);
    expect((lista.body as { id: string }[]).map((p) => p.id)).not.toContain(
      productoA.id,
    );
    await b().get(`/productos/escanear/${productoA.codigoBarras}`).expect(404);
  });

  it('no puede editar, dar de baja ni reactivar un producto ajeno', async () => {
    await b()
      .patch(`/productos/${productoA.id}`, { precioVentaCentavos: 1 })
      .expect(404);
    await b().patch(`/productos/${productoA.id}/baja`).expect(404);
    await b().patch(`/productos/${productoA.id}/reactivar`).expect(404);
  });

  it('no puede vender un producto ajeno (y el stock ajeno no cambia)', async () => {
    await b()
      .post('/ventas', {
        items: [{ productoId: productoA.id, cantidad: 1 }],
        montoRecibidoCentavos: 500,
      })
      .expect(404);
    const lista = await cliente(app, tokenA).get('/productos').expect(200);
    const p = (lista.body as { id: string; stock: number }[]).find(
      (x) => x.id === productoA.id,
    );
    expect(p?.stock).toBe(9);
  });

  it('no puede mover el inventario ni los lotes de un producto ajeno', async () => {
    await b()
      .post('/inventario/abastecimiento', {
        productoId: productoA.id,
        cantidad: 5,
        costoUnitarioCentavos: 10,
      })
      .expect(404);
    await b()
      .post('/inventario/merma', {
        productoId: productoA.id,
        cantidad: 1,
        motivo: 'robado',
      })
      .expect(404);
    await b()
      .put(`/inventario/productos/${productoA.id}/lotes`, {
        lotes: [{ fechaVencimiento: null, cantidad: 9 }],
      })
      .expect(404);
  });

  it('no ve ni anula ventas ajenas', async () => {
    const hoy = await b().get('/ventas/hoy').expect(200);
    expect(hoy.body).toEqual([]);
    const historial = await b().get('/ventas').expect(200);
    expect((historial.body as { total: number }).total).toBe(0);
    const resumen = await b().get('/ventas/resumen').expect(200);
    expect((resumen.body as { cantidadVentas: number }).cantidadVentas).toBe(0);
    await b()
      .post(`/ventas/${ventaA.id}/anular`, { motivo: 'no es mía' })
      .expect(404);
  });

  it('no ve ni toca el equipo de otra tienda', async () => {
    const equipo = await b().get('/usuarios').expect(200);
    expect((equipo.body as { id: string }[]).map((u) => u.id)).not.toContain(
      cajeroA.id,
    );
    await b().patch(`/usuarios/${cajeroA.id}/desactivar`).expect(404);
    await b()
      .patch(`/usuarios/${cajeroA.id}/password`, { password: 'hackeada-123' })
      .expect(404);
  });

  it('el mismo código de barras puede existir en dos tiendas', async () => {
    await crearProducto(app, tokenB, { codigoBarras: productoA.codigoBarras });
  });
});
