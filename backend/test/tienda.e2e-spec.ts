import { NestExpressApplication } from '@nestjs/platform-express';
import {
  abrirCaja,
  cliente,
  crearApp,
  crearCajero,
  crearProducto,
  crearTienda,
} from './utilidades';

interface Tienda {
  nombre: string;
  razonSocial: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  mensajeTicket: string | null;
}

describe('Datos de la tienda', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
  });
  afterAll(() => app.close());

  it('una tienda nueva solo tiene el nombre', async () => {
    const admin = (await crearTienda(app, 'Bodega Don Pepe')).accessToken;
    const tienda = (await cliente(app, admin).get('/tienda').expect(200))
      .body as Tienda;
    expect(tienda).toEqual({
      nombre: 'Bodega Don Pepe',
      razonSocial: null,
      ruc: null,
      direccion: null,
      telefono: null,
      mensajeTicket: null,
    });
  });

  it('el admin los carga y salen en el ticket', async () => {
    const admin = (await crearTienda(app)).accessToken;
    const guardada = (
      await cliente(app, admin)
        .patch('/tienda', {
          nombre: '  Minimarket Sol  ',
          razonSocial: 'Pérez López Juan Carlos',
          ruc: '1712345678 001',
          direccion: 'Av. Amazonas N24-03 y Colón, Quito',
          telefono: '098 000 0000',
          mensajeTicket: 'Horario: 7h a 21h',
        })
        .expect(200)
    ).body as Tienda;
    expect(guardada.nombre).toBe('Minimarket Sol');
    expect(guardada.ruc).toBe('1712345678001');

    await abrirCaja(app, admin);
    const p = await crearProducto(app, admin);
    const venta = (
      await cliente(app, admin)
        .post('/ventas', {
          items: [{ productoId: p.id, cantidad: 1 }],
          montoRecibidoCentavos: 500,
        })
        .expect(201)
    ).body as { id: string };
    const ticket = (
      await cliente(app, admin).get(`/ventas/${venta.id}/ticket`).expect(200)
    ).body as { tienda: Tienda };
    expect(ticket.tienda).toEqual(guardada);
  });

  it('vaciar un campo lo borra; lo que no viene no cambia', async () => {
    const admin = (await crearTienda(app)).accessToken;
    await cliente(app, admin)
      .patch('/tienda', { telefono: '02 222 2222', direccion: 'Calle 1' })
      .expect(200);
    const tienda = (
      await cliente(app, admin).patch('/tienda', { telefono: '' }).expect(200)
    ).body as Tienda;
    expect(tienda.telefono).toBeNull();
    expect(tienda.direccion).toBe('Calle 1');
  });

  it('valida el RUC y los largos', async () => {
    const admin = (await crearTienda(app)).accessToken;
    for (const ruc of [
      '12345',
      '1712345678000',
      '2512345678001',
      'abcdefghijklm',
    ]) {
      await cliente(app, admin).patch('/tienda', { ruc }).expect(400);
    }
    await cliente(app, admin).patch('/tienda', { nombre: 'X' }).expect(400);
    await cliente(app, admin)
      .patch('/tienda', { mensajeTicket: 'x'.repeat(201) })
      .expect(400);
  });

  it('el cajero no los ve ni los cambia', async () => {
    const admin = (await crearTienda(app)).accessToken;
    const cajero = await crearCajero(app, admin);
    await cliente(app, cajero.accessToken).get('/tienda').expect(403);
    await cliente(app, cajero.accessToken)
      .patch('/tienda', { nombre: 'Mía' })
      .expect(403);
  });
});
