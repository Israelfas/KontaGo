import { NestExpressApplication } from '@nestjs/platform-express';
import { cliente, crearApp, crearTienda } from './utilidades';

interface Producto {
  id: string;
  codigoBarras: string;
  nombre: string;
}

describe('Productos sin código de barras', () => {
  let app: NestExpressApplication;
  let admin: string;

  beforeAll(async () => {
    app = await crearApp();
    admin = (await crearTienda(app)).accessToken;
  });

  afterAll(() => app.close());

  it('sin código se le asigna uno interno (EAN-13 con prefijo 20)', async () => {
    const api = cliente(app, admin);
    const pan = (
      await api
        .post('/productos', {
          nombre: 'Pan de sal',
          precioVentaCentavos: 15,
          stockInicial: 50,
        })
        .expect(201)
    ).body as Producto;
    expect(pan.codigoBarras).toMatch(/^20\d{11}$/);

    // Se encuentra por ese código, como cualquier otro.
    const escaneado = (
      await api.get(`/productos/escanear/${pan.codigoBarras}`).expect(200)
    ).body as Producto;
    expect(escaneado.id).toBe(pan.id);
  });

  it('cada producto sin código recibe uno distinto', async () => {
    const api = cliente(app, admin);
    const crear = async (nombre: string) =>
      (
        (
          await api
            .post('/productos', { nombre, precioVentaCentavos: 10 })
            .expect(201)
        ).body as Producto
      ).codigoBarras;
    const codigos = await Promise.all(
      ['Huevo', 'Caramelo', 'Funda'].map(crear),
    );
    expect(new Set(codigos).size).toBe(3);
  });

  it('un código vacío no se acepta (o se manda uno, o ninguno)', async () => {
    await cliente(app, admin)
      .post('/productos', {
        codigoBarras: '',
        nombre: 'Sin nada',
        precioVentaCentavos: 10,
      })
      .expect(400);
  });
});
