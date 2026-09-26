import { NestExpressApplication } from '@nestjs/platform-express';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

interface Turno {
  id: string;
  estado: 'abierto' | 'cerrado';
  cajero: string;
  cerradoPor: string | null;
  cantidadVentas: number;
  ventasTransferenciaCentavos: number;
  ingresosCentavos: number;
  retirosCentavos: number;
  ventasEfectivoCentavos?: number;
  efectivoEsperadoCentavos?: number;
  efectivoContadoCentavos?: number;
  diferenciaCentavos?: number;
  movimientos: { tipo: string; montoCentavos: number; motivo: string }[];
}
interface Venta {
  id: string;
  metodoPago: string;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
}

describe('Caja (turnos y arqueo)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });
  afterAll(() => app.close());

  /** Una tienda con un producto de $1,15 y un cajero, sin cajas abiertas. */
  async function escenario() {
    const admin = (await crearTienda(app)).accessToken;
    const cajero = await crearCajero(app, admin);
    const producto = await crearProducto(app, admin, {
      precioVentaCentavos: 115,
      stockInicial: 100,
    });
    const vender = (
      token: string,
      cantidad: number,
      pago: Record<string, unknown> = { montoRecibidoCentavos: 10_000 },
    ) =>
      cliente(app, token).post('/ventas', {
        items: [{ productoId: producto.id, cantidad }],
        ...pago,
      });
    const turnoDe = async (token: string) =>
      (
        (await cliente(app, token).get('/caja/actual').expect(200)).body as {
          turno: Turno | null;
        }
      ).turno;
    const turnosComoAdmin = async () =>
      (await cliente(app, admin).get('/caja/turnos').expect(200))
        .body as Turno[];
    return { admin, cajero, producto, vender, turnoDe, turnosComoAdmin };
  }

  it('sin caja abierta no se puede vender (y el stock no cambia)', async () => {
    const { cajero, producto, vender, admin } = await escenario();
    await vender(cajero.accessToken, 1).expect(409);
    const lista = await cliente(app, admin).get('/productos').expect(200);
    const p = (lista.body as { id: string; stock: number }[]).find(
      (x) => x.id === producto.id,
    );
    expect(p?.stock).toBe(100);
  });

  it('no se puede tener dos cajas abiertas a la vez', async () => {
    const { cajero } = await escenario();
    await abrirCaja(app, cajero.accessToken);
    await cliente(app, cajero.accessToken)
      .post('/caja/abrir', { fondoInicialCentavos: 0 })
      .expect(409);
  });

  it('arqueo: fondo + ventas en efectivo + ingresos − retiros; la transferencia va aparte', async () => {
    const { cajero, vender, turnoDe, turnosComoAdmin } = await escenario();
    const token = cajero.accessToken;
    await abrirCaja(app, token, 2000);

    // Efectivo: 2 × $1,15 = $2,30, paga con $5 → vuelto $2,70.
    const efectivo = (
      await vender(token, 2, { montoRecibidoCentavos: 500 }).expect(201)
    ).body as Venta;
    expect(efectivo.vueltoCentavos).toBe(270);
    // Transferencia: sin monto recibido ni vuelto.
    const transferencia = (
      await vender(token, 1, { metodoPago: 'transferencia' }).expect(201)
    ).body as Venta;
    expect(transferencia.metodoPago).toBe('transferencia');
    expect(transferencia.montoRecibidoCentavos).toBe(115);
    expect(transferencia.vueltoCentavos).toBe(0);

    await cliente(app, token)
      .post('/caja/movimientos', {
        tipo: 'retiro',
        montoCentavos: 50,
        motivo: 'Pago al de las colas',
      })
      .expect(201);
    await cliente(app, token)
      .post('/caja/movimientos', {
        tipo: 'ingreso',
        montoCentavos: 30,
        motivo: 'Cambio que trajo la dueña',
      })
      .expect(201);

    // Conteo a ciegas: el cajero no ve lo esperado mientras está abierto.
    const abierto = await turnoDe(token);
    expect(abierto?.estado).toBe('abierto');
    expect(abierto?.cantidadVentas).toBe(2);
    expect(abierto?.ventasTransferenciaCentavos).toBe(115);
    expect(abierto).not.toHaveProperty('efectivoEsperadoCentavos');
    expect(abierto).not.toHaveProperty('ventasEfectivoCentavos');

    // El admin sí lo ve: 2000 + 230 + 30 − 50 = 2210.
    const visto = (await turnosComoAdmin()).find((t) => t.id === abierto?.id);
    expect(visto?.efectivoEsperadoCentavos).toBe(2210);

    // Faltan 10 centavos.
    const cierre = (
      await cliente(app, token)
        .post('/caja/cerrar', {
          efectivoContadoCentavos: 2200,
          nota: 'Revisar',
        })
        .expect(200)
    ).body as Turno;
    expect(cierre.estado).toBe('cerrado');
    expect(cierre.efectivoEsperadoCentavos).toBe(2210);
    expect(cierre.ventasEfectivoCentavos).toBe(230);
    expect(cierre.efectivoContadoCentavos).toBe(2200);
    expect(cierre.diferenciaCentavos).toBe(-10);
    expect(cierre.movimientos).toHaveLength(2);

    // Cerrada la caja, no se vende más.
    expect(await turnoDe(token)).toBeNull();
    await vender(token, 1).expect(409);
  });

  it('en efectivo hay que decir cuánto pagó; en transferencia no', async () => {
    const { cajero, vender } = await escenario();
    await abrirCaja(app, cajero.accessToken);
    await vender(cajero.accessToken, 1, {}).expect(400);
    await vender(cajero.accessToken, 1, { metodoPago: 'transferencia' }).expect(
      201,
    );
  });

  it('anular con la caja de la venta abierta la descuenta de su arqueo', async () => {
    const { admin, cajero, vender, turnosComoAdmin } = await escenario();
    await abrirCaja(app, cajero.accessToken, 1000);
    const venta = (
      await vender(cajero.accessToken, 2, { montoRecibidoCentavos: 230 })
    ).body as Venta;
    await cliente(app, admin)
      .post(`/ventas/${venta.id}/anular`, { motivo: 'se arrepintió' })
      .expect(200);
    const turno = (await turnosComoAdmin())[0];
    expect(turno.efectivoEsperadoCentavos).toBe(1000);
    expect(turno.cantidadVentas).toBe(0);
  });

  it('anular una venta de un turno ya cerrado: la plata sale de la caja de quien anula', async () => {
    const { admin, cajero, vender, turnoDe } = await escenario();
    await abrirCaja(app, cajero.accessToken);
    const venta = (
      await vender(cajero.accessToken, 2, { montoRecibidoCentavos: 230 })
    ).body as Venta;
    const cierre = (
      await cliente(app, cajero.accessToken)
        .post('/caja/cerrar', { efectivoContadoCentavos: 2230 })
        .expect(200)
    ).body as Turno;
    expect(cierre.diferenciaCentavos).toBe(0);

    // El admin no tiene caja abierta: no hay de dónde devolver.
    await cliente(app, admin)
      .post(`/ventas/${venta.id}/anular`, { motivo: 'devolución' })
      .expect(400);

    await abrirCaja(app, admin, 5000);
    await cliente(app, admin)
      .post(`/ventas/${venta.id}/anular`, { motivo: 'devolución' })
      .expect(200);
    const cajaAdmin = await turnoDe(admin);
    expect(cajaAdmin?.retirosCentavos).toBe(230);
    expect(cajaAdmin?.efectivoEsperadoCentavos).toBe(5000 - 230);
    expect(cajaAdmin?.movimientos[0].motivo).toMatch(/devolución/i);

    // El arqueo del turno cerrado no cambia.
    const turnos = (await cliente(app, admin).get('/caja/turnos'))
      .body as Turno[];
    const delCajero = turnos.find((t) => t.id === cierre.id);
    expect(delCajero?.efectivoEsperadoCentavos).toBe(2230);
    expect(delCajero?.diferenciaCentavos).toBe(0);
  });

  it('el admin puede cerrar la caja que un cajero dejó abierta; el cajero no', async () => {
    const { admin, cajero, turnoDe } = await escenario();
    await abrirCaja(app, cajero.accessToken, 1500);
    const turno = await turnoDe(cajero.accessToken);

    await cliente(app, cajero.accessToken)
      .post(`/caja/turnos/${turno!.id}/cerrar`, { efectivoContadoCentavos: 0 })
      .expect(403);
    await cliente(app, cajero.accessToken).get('/caja/turnos').expect(403);

    const cierre = (
      await cliente(app, admin)
        .post(`/caja/turnos/${turno!.id}/cerrar`, {
          efectivoContadoCentavos: 1500,
        })
        .expect(200)
    ).body as Turno;
    expect(cierre.cerradoPor).toBe('Admin');
    expect(cierre.cajero).toBe('Cajero');
    await cliente(app, admin)
      .post(`/caja/turnos/${turno!.id}/cerrar`, {
        efectivoContadoCentavos: 1500,
      })
      .expect(409);
  });

  it('una tienda no ve ni cierra las cajas de otra', async () => {
    const a = await escenario();
    const b = await escenario();
    await abrirCaja(app, a.cajero.accessToken);
    const turnoA = await a.turnoDe(a.cajero.accessToken);
    expect(
      (await b.turnosComoAdmin()).map((t) => t.id).includes(turnoA!.id),
    ).toBe(false);
    await cliente(app, b.admin)
      .post(`/caja/turnos/${turnoA!.id}/cerrar`, { efectivoContadoCentavos: 0 })
      .expect(404);
  });

  it('el resumen separa lo cobrado en efectivo y por transferencia', async () => {
    const { admin, vender } = await escenario();
    await abrirCaja(app, admin);
    await vender(admin, 2).expect(201);
    await vender(admin, 1, { metodoPago: 'transferencia' }).expect(201);
    const resumen = (await cliente(app, admin).get('/ventas/resumen')).body as {
      efectivoCentavos: number;
      transferenciaCentavos: number;
      ingresoBrutoCentavos: number;
    };
    expect(resumen.efectivoCentavos).toBe(230);
    expect(resumen.transferenciaCentavos).toBe(115);
    expect(resumen.ingresoBrutoCentavos).toBe(345);
  });

  it('valida montos y motivos', async () => {
    const { cajero } = await escenario();
    await cliente(app, cajero.accessToken)
      .post('/caja/abrir', { fondoInicialCentavos: -1 })
      .expect(400);
    await abrirCaja(app, cajero.accessToken);
    await cliente(app, cajero.accessToken)
      .post('/caja/movimientos', {
        tipo: 'retiro',
        montoCentavos: 0,
        motivo: 'x',
      })
      .expect(400);
    await cliente(app, cajero.accessToken)
      .post('/caja/cerrar', { efectivoContadoCentavos: 'mucho' })
      .expect(400);
  });
  it('un turno con más de 2.147.483.647 centavos en ingresos se cierra y se lista igual', async () => {
    const admin = (await crearTienda(app)).accessToken;
    const cajero = await crearCajero(app, admin);
    await abrirCaja(app, cajero.accessToken, 0);
    // 215 ingresos de $100.000: la suma pasa el máximo de un entero de 32 bits.
    for (let i = 0; i < 215; i++) {
      await cliente(app, cajero.accessToken)
        .post('/caja/movimientos', {
          tipo: 'ingreso',
          montoCentavos: 10_000_000,
          motivo: 'prueba de sumas grandes',
        })
        .expect(201);
    }
    const cierre = (
      await cliente(app, cajero.accessToken)
        .post('/caja/cerrar', { efectivoContadoCentavos: 0 })
        .expect(200)
    ).body as Turno;
    expect(cierre.ingresosCentavos).toBe(2_150_000_000);
    expect(cierre.efectivoEsperadoCentavos).toBe(2_150_000_000);

    const turnos = (await cliente(app, admin).get('/caja/turnos').expect(200))
      .body as Turno[];
    expect(turnos.find((t) => t.id === cierre.id)?.ingresosCentavos).toBe(
      2_150_000_000,
    );
    await cliente(app, admin).get('/reportes/excel').expect(200);
  });
});
