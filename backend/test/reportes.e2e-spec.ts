import { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import request from 'supertest';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

/** Baja el reporte como archivo (supertest lo trataría como texto). */
async function bajarReporte(
  app: NestExpressApplication,
  token: string,
  consulta = '',
) {
  const res = await request(app.getHttpServer())
    .get(`/reportes/excel${consulta}`)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((respuesta, listo) => {
      const partes: Buffer[] = [];
      respuesta.on('data', (parte: Buffer) => partes.push(parte));
      respuesta.on('end', () => listo(null, Buffer.concat(partes)));
    });
  return res;
}

async function abrirLibro(contenido: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido as unknown as ArrayBuffer);
  return libro;
}

/** Valor de una celda: las sumas del pie son fórmulas con su resultado. */
function valor(hoja: ExcelJS.Worksheet, fila: number, titulo: string): unknown {
  const encabezados = hoja.getRow(1).values as unknown[];
  const celda = hoja.getRow(fila).getCell(encabezados.indexOf(titulo)).value;
  return celda !== null && typeof celda === 'object' && 'result' in celda
    ? celda.result
    : celda;
}

describe('Reporte en Excel (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('trae ventas, productos, caja e inventario, y sus totales coinciden con el resumen', async () => {
    const { accessToken: admin } = await crearTienda(app, 'Bodega Doña Rosa');
    const cajero = await crearCajero(app, admin);
    const producto = await crearProducto(app, admin, {
      nombre: 'Leche 1 L',
      precioVentaCentavos: 115,
      costoUnitarioCentavos: 60,
      stockInicial: 20,
    });

    // Una venta de 3 unidades en la caja del cajero, que cierra con $0,45 de menos.
    await abrirCaja(app, cajero.accessToken, 2000);
    await cliente(app, cajero.accessToken)
      .post('/ventas', {
        items: [{ productoId: producto.id, cantidad: 3 }],
        montoRecibidoCentavos: 500,
      })
      .expect(201);
    await cliente(app, cajero.accessToken)
      .post('/caja/cerrar', { efectivoContadoCentavos: 2300 })
      .expect(200);
    await cliente(app, admin)
      .post('/inventario/merma', {
        productoId: producto.id,
        cantidad: 2,
        motivo: 'danado',
      })
      .expect(201);

    const res = await bajarReporte(app, admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="kontago-bodega-dona-rosa-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );

    const libro = await abrirLibro(res.body as Buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual([
      'Resumen',
      'Ventas',
      'Productos vendidos',
      'Caja',
      'Movimientos de caja',
      'Compras y mermas',
      'Stock actual',
    ]);

    const resumen = (
      await cliente(app, admin).get('/ventas/resumen').expect(200)
    ).body as {
      ingresoBrutoCentavos: number;
      gananciaCentavos: number;
    };

    // Ventas: una fila y el pie con las sumas.
    const ventas = libro.getWorksheet('Ventas')!;
    expect(valor(ventas, 2, 'Ticket')).toBe(1);
    expect(valor(ventas, 2, 'Cajero')).toBe('Cajero');
    expect(valor(ventas, 2, 'Pago')).toBe('Efectivo');
    expect(valor(ventas, 2, 'Cobrado')).toBe(3.45);
    expect(valor(ventas, 3, 'Ticket')).toBe('Total');
    expect(valor(ventas, 3, 'Cobrado')).toBe(
      resumen.ingresoBrutoCentavos / 100,
    );
    expect(valor(ventas, 3, 'Ganancia')).toBe(resumen.gananciaCentavos / 100);

    // El detalle por producto suma la misma ganancia.
    const lineas = libro.getWorksheet('Productos vendidos')!;
    expect(valor(lineas, 2, 'Producto')).toBe('Leche 1 L');
    expect(valor(lineas, 2, 'Vendidas')).toBe(3);
    expect(valor(lineas, 3, 'Ganancia')).toBe(resumen.gananciaCentavos / 100);

    // La caja cerró con $0,45 de menos: 20 + 3,45 esperados, 23 contados.
    const caja = libro.getWorksheet('Caja')!;
    expect(valor(caja, 2, 'Estado')).toBe('Cerrada');
    expect(valor(caja, 2, 'Debería haber')).toBe(23.45);
    expect(valor(caja, 2, 'Diferencia')).toBe(-0.45);

    // La merma, valorizada al costo.
    const inventario = libro.getWorksheet('Compras y mermas')!;
    const tipos = [2, 3].map((fila) => valor(inventario, fila, 'Tipo'));
    expect(tipos).toContain('Merma');
    const filaMerma = 2 + tipos.indexOf('Merma');
    expect(valor(inventario, filaMerma, 'Motivo')).toBe('Dañado');
    expect(valor(inventario, filaMerma, 'Pérdida')).toBe(1.2);

    // Stock al momento de bajar: 20 − 3 vendidas − 2 de merma.
    const stock = libro.getWorksheet('Stock actual')!;
    expect(valor(stock, 2, 'Stock')).toBe(15);
    expect(valor(stock, 2, 'Valor al costo')).toBe(9);
  });

  it('cada tienda baja solo lo suyo', async () => {
    const a = await crearTienda(app, 'Tienda A');
    const producto = await crearProducto(app, a.accessToken);
    await abrirCaja(app, a.accessToken);
    await cliente(app, a.accessToken)
      .post('/ventas', {
        items: [{ productoId: producto.id, cantidad: 1 }],
        montoRecibidoCentavos: 200,
      })
      .expect(201);

    const b = await crearTienda(app, 'Tienda B');
    const libro = await abrirLibro(
      (await bajarReporte(app, b.accessToken)).body as Buffer,
    );
    // Solo el encabezado y el pie de totales en cero.
    expect(libro.getWorksheet('Ventas')!.rowCount).toBe(2);
    expect(libro.getWorksheet('Stock actual')!.rowCount).toBe(2);
  });

  it('solo el admin, y hasta 92 días', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    expect((await bajarReporte(app, cajero.accessToken)).status).toBe(403);
    expect(
      (await bajarReporte(app, admin, '?desde=2026-01-01&hasta=2026-09-01'))
        .status,
    ).toBe(400);
  });
});
