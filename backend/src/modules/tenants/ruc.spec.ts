import { esRucValido } from './ruc';

describe('esRucValido', () => {
  it('acepta persona natural, sociedad privada y entidad pública', () => {
    expect(esRucValido('1712345678001')).toBe(true); // Pichincha, persona natural
    expect(esRucValido('0992345678001')).toBe(true); // Guayas, sociedad privada
    expect(esRucValido('1760001234001')).toBe(true); // entidad pública
    expect(esRucValido('3050001234001')).toBe(true); // inscrito en el exterior
  });

  it('acepta otros establecimientos (002, 003…)', () => {
    expect(esRucValido('1712345678002')).toBe(true);
  });

  it('rechaza largo o caracteres inválidos', () => {
    expect(esRucValido('171234567800')).toBe(false);
    expect(esRucValido('17123456780011')).toBe(false);
    expect(esRucValido('17123456780O1')).toBe(false);
    expect(esRucValido('1712-345678-001')).toBe(false);
  });

  it('rechaza provincias que no existen', () => {
    expect(esRucValido('0012345678001')).toBe(false);
    expect(esRucValido('2512345678001')).toBe(false);
  });

  it('rechaza un tercer dígito que no es de ningún tipo', () => {
    expect(esRucValido('1772345678001')).toBe(false);
    expect(esRucValido('1782345678001')).toBe(false);
  });

  it('rechaza el establecimiento 000', () => {
    expect(esRucValido('1712345678000')).toBe(false);
  });
});
