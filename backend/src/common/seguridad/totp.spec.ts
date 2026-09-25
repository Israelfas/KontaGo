import {
  aBase32,
  codigoDelPaso,
  deBase32,
  enlaceOtpauth,
  generarSecreto,
  verificarCodigo,
} from './totp';

// Vectores de prueba del RFC 6238 (apéndice B), SHA-1, 8 dígitos.
const SECRETO_RFC = Buffer.from('12345678901234567890');
const VECTORES: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
];

describe('TOTP (RFC 6238)', () => {
  it.each(VECTORES)('a los %i segundos da %s', (segundos, esperado) => {
    expect(codigoDelPaso(SECRETO_RFC, Math.floor(segundos / 30), 8)).toBe(
      esperado,
    );
  });

  it('Base32 ida y vuelta', () => {
    expect(aBase32(SECRETO_RFC)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(
      deBase32('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ').equals(SECRETO_RFC),
    ).toBe(true);
  });

  it('acepta el código del momento y el de 30 s antes o después', () => {
    const secreto = generarSecreto();
    const ahora = 1_800_000_000_000;
    const paso = Math.floor(ahora / 30_000);
    const codigo = (p: number) => codigoDelPaso(deBase32(secreto), p);

    expect(verificarCodigo(secreto, codigo(paso), ahora)).toBe(paso);
    expect(verificarCodigo(secreto, codigo(paso - 1), ahora)).toBe(paso - 1);
    expect(verificarCodigo(secreto, codigo(paso + 1), ahora)).toBe(paso + 1);
    // Uno de hace dos minutos ya no sirve.
    expect(verificarCodigo(secreto, codigo(paso - 4), ahora)).toBeNull();
  });

  it('rechaza lo que no es un código de 6 dígitos', () => {
    const secreto = generarSecreto();
    expect(verificarCodigo(secreto, '12345')).toBeNull();
    expect(verificarCodigo(secreto, 'abcdef')).toBeNull();
  });

  it('el enlace para la app autenticadora', () => {
    const enlace = enlaceOtpauth('ABC234', 'demo@kontago.test');
    expect(enlace).toBe(
      'otpauth://totp/KontaGo%3Ademo%40kontago.test?secret=ABC234&issuer=KontaGo&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('cada secreto es distinto y de 32 caracteres', () => {
    const a = generarSecreto();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(generarSecreto()).not.toBe(a);
  });
});
