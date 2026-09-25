import {
  digitoDeControl,
  esCodigoInterno,
  generarCodigoInterno,
} from './codigo-interno';

describe('código interno', () => {
  it('calcula el dígito de control de un EAN-13 real', () => {
    // 7861001234567 no sirve: su último dígito es inventado. Uno real:
    expect(digitoDeControl('400638133393')).toBe(1); // 4006381333931
    expect(digitoDeControl('590123412345')).toBe(7); // 5901234123457
  });

  it('genera EAN-13 válidos con prefijo 20, distintos entre sí', () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const codigo = generarCodigoInterno();
      expect(codigo).toMatch(/^20\d{11}$/);
      expect(Number(codigo[12])).toBe(digitoDeControl(codigo.slice(0, 12)));
      expect(esCodigoInterno(codigo)).toBe(true);
      codigos.add(codigo);
    }
    expect(codigos.size).toBe(200);
  });

  it('no confunde un código de fabricante con uno interno', () => {
    expect(esCodigoInterno('7861001234567')).toBe(false);
    expect(esCodigoInterno('20123')).toBe(false);
  });
});
