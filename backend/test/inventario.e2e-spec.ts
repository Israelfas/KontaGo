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

interface Movimiento {
  id: string;
  tipo: 'abastecimiento' | 'merma';
  producto: { id: string; nombre: string };
  cantidad: number;
  costoUnitarioCentavos: number;
  totalCentavos: number;
  proveedor: string | null;
  motivo: string | null;
  vencimientoLote: string | null;
  registradoPor: string;
}
interface Pagina {
  movimientos: Movimiento[];
  total: number;
}
interface Resumen {
  egresoCentavos: number;
  cantidadAbastecimientos: number;
  perdidaCentavos: number;
  cantidadMermas: number;
  perdidaPorMotivo: { motivo: string; unidades: number; centavos: number }[];
  porProveedor: {
    proveedor: string | null;
    compras: number;
    centavos: number;
  }[];
  productosConMasPerdida: {
    nombre: string;
    unidades: number;
    centavos: number;
  }[];
}

describe('Historial de inventario', () => {
  let app: NestExpressApplication;
  let admin: string;
  let leche: { id: string };
  let arroz: { id: string };

  beforeAll(async () => {
    app = await crearApp();
    admin = (await crearTienda(app)).accessToken;
    leche = await crearProducto(app, admin, {
      nombre: 'Leche',
      costoUnitarioCentavos: 80,
      stockInicial: 20,
      fechaVencimiento: fechaEnDias(10),
    });
    arroz = await crearProducto(app, admin, {
      nombre: 'Arroz',
      costoUnitarioCentavos: 200,
      stockInicial: 20,
    });
    const api = cliente(app, admin);
    await api
      .post('/inventario/abastecimiento', {
        productoId: leche.id,
        cantidad: 12,
        costoUnitarioCentavos: 80,
        proveedor: 'Pasteurizadora Quito',
        fechaVencimiento: fechaEnDias(15),
      })
      .expect(201);
    await api
      .post('/inventario/abastecimiento', {
        productoId: arroz.id,
        cantidad: 10,
        costoUnitarioCentavos: 200,
        proveedor: 'Distribuidora Andina',
      })
      .expect(201);
    // Mismo proveedor escrito distinto: tiene que sumar junto.
    await api
      .post('/inventario/abastecimiento', {
        productoId: leche.id,
        cantidad: 6,
        costoUnitarioCentavos: 80,
        proveedor: 'pasteurizadora quito ',
        fechaVencimiento: fechaEnDias(15),
      })
      .expect(201);
    await api
      .post('/inventario/merma', {
        productoId: leche.id,
        cantidad: 3,
        motivo: 'vencido',
      })
      .expect(201);
    await api
      .post('/inventario/merma', {
        productoId: arroz.id,
        cantidad: 1,
        motivo: 'danado',
      })
      .expect(201);
  });
  afterAll(() => app.close());

  const listar = async (query = '') =>
    (
      await cliente(app, admin)
        .get(`/inventario/movimientos${query}`)
        .expect(200)
    ).body as Pagina;

  it('lista abastecimientos y mermas de hoy, del más reciente al más viejo', async () => {
    const { movimientos, total } = await listar();
    expect(total).toBe(5);
    expect(movimientos[0].tipo).toBe('merma');
    expect(movimientos.at(-1)?.tipo).toBe('abastecimiento');
    expect(movimientos.every((m) => m.registradoPor === 'Admin')).toBe(true);
  });

  it('cada movimiento trae su total y el vencimiento del lote', async () => {
    const { movimientos } = await listar('?tipo=abastecimiento');
    const primero = movimientos.find((m) => m.cantidad === 12)!;
    expect(primero.totalCentavos).toBe(960);
    expect(primero.vencimientoLote).toBe(fechaEnDias(15));
    expect(primero.proveedor).toBe('Pasteurizadora Quito');
  });

  it('filtra por tipo y por producto', async () => {
    const mermas = await listar('?tipo=merma');
    expect(mermas.total).toBe(2);
    expect(mermas.movimientos.every((m) => m.tipo === 'merma')).toBe(true);
    const deLeche = await listar(`?productoId=${leche.id}`);
    expect(deLeche.total).toBe(3);
    expect(deLeche.movimientos.every((m) => m.producto.id === leche.id)).toBe(
      true,
    );
  });

  it('pagina sin repetir', async () => {
    const uno = await listar('?limite=2');
    const dos = await listar('?limite=2&desplazamiento=2');
    expect(uno.movimientos).toHaveLength(2);
    const ids = [...uno.movimientos, ...dos.movimientos].map((m) => m.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('respeta el período', async () => {
    const [{ id }] = (await listar('?tipo=merma&limite=1')).movimientos;
    await app
      .get(DataSource)
      .query(
        `UPDATE movimientos_inventario SET created_at = created_at - interval '3 days' WHERE id = $1`,
        [id],
      );
    expect((await listar()).total).toBe(4);
    expect(
      (await listar(`?desde=${fechaEnDias(-3)}&hasta=${fechaEnDias(-3)}`))
        .total,
    ).toBe(1);
    expect(
      (await listar(`?desde=${fechaEnDias(-6)}&hasta=${fechaEnDias(0)}`)).total,
    ).toBe(5);
  });

  it('el resumen suma lo gastado, lo perdido y los desgloses', async () => {
    const r = (
      await cliente(app, admin)
        .get(
          `/inventario/resumen?desde=${fechaEnDias(-6)}&hasta=${fechaEnDias(0)}`,
        )
        .expect(200)
    ).body as Resumen;
    // 12 y 6 leches a 80 + 10 arroces a 200.
    expect(r.egresoCentavos).toBe(960 + 480 + 2000);
    expect(r.cantidadAbastecimientos).toBe(3);
    expect(r.cantidadMermas).toBe(2);
    expect(r.perdidaCentavos).toBe(3 * 80 + 200);
    expect(r.perdidaPorMotivo.map((m) => m.motivo)).toEqual([
      'vencido',
      'danado',
    ]);
    // "Pasteurizadora Quito" y "pasteurizadora quito " son el mismo.
    expect(r.porProveedor).toEqual([
      { proveedor: 'Distribuidora Andina', compras: 1, centavos: 2000 },
      { proveedor: 'Pasteurizadora Quito', compras: 2, centavos: 1440 },
    ]);
    expect(r.productosConMasPerdida[0]).toEqual({
      nombre: 'Leche',
      unidades: 3,
      centavos: 240,
    });
  });

  it('valida los filtros', async () => {
    await cliente(app, admin)
      .get('/inventario/movimientos?tipo=regalo')
      .expect(400);
    await cliente(app, admin)
      .get('/inventario/movimientos?productoId=no-es-uuid')
      .expect(400);
    await cliente(app, admin)
      .get(
        `/inventario/resumen?desde=${fechaEnDias(-100)}&hasta=${fechaEnDias(0)}`,
      )
      .expect(400);
  });

  it('el cajero no lo ve; otra tienda no ve los de esta', async () => {
    const cajero = await crearCajero(app, admin);
    await cliente(app, cajero.accessToken)
      .get('/inventario/movimientos')
      .expect(403);
    await cliente(app, cajero.accessToken)
      .get('/inventario/resumen')
      .expect(403);
    const otra = (await crearTienda(app)).accessToken;
    const suyos = (
      await cliente(app, otra).get('/inventario/movimientos').expect(200)
    ).body as Pagina;
    expect(suyos.total).toBe(0);
  });
});
