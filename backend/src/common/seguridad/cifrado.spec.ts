import { cifrar, descifrar } from './cifrado';

describe('cifrado de datos sensibles', () => {
  it('ida y vuelta, y cada vez sale distinto', () => {
    const a = cifrar('JBSWY3DPEHPK3PXP', 'una clave');
    const b = cifrar('JBSWY3DPEHPK3PXP', 'una clave');
    expect(a).not.toBe(b);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(descifrar(a, 'una clave')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('con otra clave, o si lo alteraron, falla', () => {
    const guardado = cifrar('secreto', 'una clave');
    expect(() => descifrar(guardado, 'otra clave')).toThrow();
    const partes = guardado.split(':');
    partes[3] = Buffer.from('otro dato').toString('base64');
    expect(() => descifrar(partes.join(':'), 'una clave')).toThrow();
  });
});
