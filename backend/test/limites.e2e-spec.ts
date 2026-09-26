import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/modules/auth/auth.service';
import { MailService } from '../src/modules/mail/mail.service';
import {
  CLAVE,
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
  emailUnico,
  fechaEnDias,
} from './utilidades';

/*
 * Lo que cada tienda puede pedir sin afectar a las demás (todas comparten
 * el servidor, la base y el correo), y lo que el cajero no necesita ver.
 */

interface Producto {
  id: string;
  codigoBarras: string;
  costoUnitarioCentavos?: number;
  proveedor?: string | null;
}

describe('Límites y datos del dueño (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(() => app.close());

  it('el cajero no ve el costo ni el proveedor; el admin sí', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const cajero = await crearCajero(app, admin);
    const p = await crearProducto(app, admin, {
      costoUnitarioCentavos: 60,
      proveedor: 'Distribuidora Andina',
      stockInicial: 3,
      stockMinimo: 5,
    });

    const delAdmin = (await cliente(app, admin).get('/productos').expect(200))
      .body as Producto[];
    expect(delAdmin[0]).toMatchObject({
      costoUnitarioCentavos: 60,
      proveedor: 'Distribuidora Andina',
    });

    const api = cliente(app, cajero.accessToken);
    const sinCosto = (p: Producto) => {
      expect(p).not.toHaveProperty('costoUnitarioCentavos');
      expect(p).not.toHaveProperty('proveedor');
    };
    ((await api.get('/productos').expect(200)).body as Producto[]).forEach(
      sinCosto,
    );
    sinCosto(
      (await api.get(`/productos/escanear/${p.codigoBarras}`).expect(200))
        .body as Producto,
    );
    const alertas = (await api.get('/productos/alertas').expect(200)).body as {
      stockBajo: Producto[];
    };
    expect(alertas.stockBajo).toHaveLength(1);
    alertas.stockBajo.forEach(sinCosto);

    await abrirCaja(app, cajero.accessToken);
    const venta = (
      await api
        .post('/ventas', {
          items: [{ productoId: p.id, cantidad: 1 }],
          montoRecibidoCentavos: 200,
        })
        .expect(201)
    ).body as { items: Producto[] };
    venta.items.forEach(sinCosto);
  });

  it('el resumen suma bien aunque el período tenga más ventas de las que se leen de una vez, y el día trae las más recientes', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const p = await crearProducto(app, admin, {
      precioVentaCentavos: 115,
      costoUnitarioCentavos: 60,
      stockInicial: 1000,
    });
    await abrirCaja(app, admin);

    const ventas = 501;
    for (let i = 0; i < ventas; i += 25) {
      await Promise.all(
        Array.from({ length: Math.min(25, ventas - i) }, () =>
          cliente(app, admin)
            .post('/ventas', {
              items: [{ productoId: p.id, cantidad: 1 }],
              montoRecibidoCentavos: 115,
            })
            .expect(201),
        ),
      );
    }

    const resumen = (await cliente(app, admin).get('/ventas/resumen-dia'))
      .body as {
      cantidadVentas: number;
      ingresoBrutoCentavos: number;
      efectivoCentavos: number;
      topProductos: { unidades: number; centavos: number }[];
    };
    expect(resumen.cantidadVentas).toBe(ventas);
    expect(resumen.ingresoBrutoCentavos).toBe(ventas * 115);
    expect(resumen.efectivoCentavos).toBe(ventas * 115);
    expect(resumen.topProductos[0]).toMatchObject({
      unidades: ventas,
      centavos: ventas * 115,
    });

    const hoy = (await cliente(app, admin).get('/ventas/hoy').expect(200))
      .body as { numero: number }[];
    expect(hoy).toHaveLength(500);
    // Las más recientes: falta solo la primera.
    expect(Math.min(...hoy.map((v) => v.numero))).toBe(2);
  }, 120_000);

  it('un Excel con demasiadas líneas se pide por partes, en vez de dejar sin memoria al servidor', async () => {
    const { accessToken: admin } = await crearTienda(app);
    const p = await crearProducto(app, admin);
    await abrirCaja(app, admin);
    const venta = (
      await cliente(app, admin)
        .post('/ventas', {
          items: [{ productoId: p.id, cantidad: 1 }],
          montoRecibidoCentavos: 200,
        })
        .expect(201)
    ).body as { id: string };
    // Líneas de sobra, directo en la base (por la API serían miles de ventas).
    await app.get(DataSource).query(
      `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_venta_centavos, costo_unitario_centavos)
       SELECT $1, $2, 1, 115, 60 FROM generate_series(1, 50000)`,
      [venta.id, p.id],
    );

    const res = await cliente(app, admin).get('/reportes/excel').expect(400);
    expect((res.body as { message: string }).message).toMatch(
      /demasiadas ventas/,
    );
  }, 60_000);

  it('"enviar ahora" le llega solo a quien lo pide, y una vez por hora', async () => {
    const correos: { destinatarios: string[] }[] = [];
    const espia = jest
      .spyOn(app.get(MailService), 'enviar')
      .mockImplementation((c) => {
        correos.push(c);
        return Promise.resolve();
      });
    const tienda = await crearTienda(app);
    await cliente(app, tienda.accessToken)
      .post('/usuarios', {
        nombre: 'Otra admin',
        email: emailUnico('otra-admin'),
        password: CLAVE,
        rol: 'admin',
      })
      .expect(201);
    await crearProducto(app, tienda.accessToken, {
      fechaVencimiento: fechaEnDias(2),
    });

    const api = cliente(app, tienda.accessToken);
    await api.post('/notificaciones/vencimientos/enviar-ahora').expect(201);
    expect(correos).toHaveLength(1);
    expect(correos[0].destinatarios).toEqual([tienda.email]);

    await api.post('/notificaciones/vencimientos/enviar-ahora').expect(429);
    expect(correos).toHaveLength(1);
    espia.mockRestore();
  });

  it('un correo del equipo ya usado se rechaza sin calcular la contraseña', async () => {
    const tienda = await crearTienda(app);
    const hash = jest.spyOn(app.get(AuthService), 'hashPassword');
    await cliente(app, tienda.accessToken)
      .post('/usuarios', {
        nombre: 'Repetida',
        email: tienda.email,
        password: CLAVE,
      })
      .expect(409);
    expect(hash).not.toHaveBeenCalled();
    hash.mockRestore();
  });
});
