import {
  importeCentavos,
  importeDelTramo,
  redondear,
  restar,
  sumar,
} from './cantidad';

describe('cantidades', () => {
  it('suma y resta sin arrastrar errores de coma flotante', () => {
    expect(sumar(0.1, 0.2)).toBe(0.3);
    expect(restar(1, 0.9)).toBe(0.1);
    expect(redondear(2.0004)).toBe(2);
    expect(redondear(2.0006)).toBe(2.001);
  });

  it('con unidades enteras el importe es la multiplicación de siempre', () => {
    expect(importeCentavos(115, 3)).toBe(345);
  });

  it('con peso redondea al centavo', () => {
    // Media libra de queso a $3,25 la libra: $1,625 → $1,63.
    expect(importeCentavos(325, 0.5)).toBe(163);
    expect(importeCentavos(100, 0.333)).toBe(33);
  });

  it('los tramos suman exactamente el importe total', () => {
    // 1 libra a $0,99, anulada en tres partes de 1/3.
    const total = importeCentavos(99, 1);
    const tramos =
      importeDelTramo(99, 0, 0.333) +
      importeDelTramo(99, 0.333, 0.333) +
      importeDelTramo(99, 0.666, 0.334);
    expect(tramos).toBe(total);
  });
});
