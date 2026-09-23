import { BadRequestException } from '@nestjs/common';
import { fechaLocal } from '../../common/formato-fecha';
import { armarRango, DIAS_MAXIMOS_RANGO } from './rango-fechas';

describe('armarRango', () => {
  it('sin fechas es hoy, de medianoche a medianoche', () => {
    const rango = armarRango();
    const hoy = fechaLocal(new Date());
    expect(rango.desde).toBe(hoy);
    expect(rango.hasta).toBe(hoy);
    expect(rango.dias).toBe(1);
    expect(rango.inicio.getHours()).toBe(0);
    expect(fechaLocal(rango.inicio)).toBe(hoy);
    expect(
      rango.finExclusivo.getTime() - rango.inicio.getTime(),
    ).toBeGreaterThanOrEqual(23 * 3600_000);
  });

  it('con una sola fecha, es ese día', () => {
    expect(armarRango('2026-09-01')).toMatchObject({
      desde: '2026-09-01',
      hasta: '2026-09-01',
      dias: 1,
    });
    expect(armarRango(undefined, '2026-09-01').desde).toBe('2026-09-01');
  });

  it('cuenta los días de calendario, ambos extremos incluidos', () => {
    const rango = armarRango('2026-09-17', '2026-09-23');
    expect(rango.dias).toBe(7);
    expect(fechaLocal(rango.inicio)).toBe('2026-09-17');
    // El corte es "menor que" la medianoche del día siguiente al último.
    expect(fechaLocal(rango.finExclusivo)).toBe('2026-09-24');
  });

  it('cruza meses y años', () => {
    expect(armarRango('2025-12-30', '2026-01-02').dias).toBe(4);
    expect(armarRango('2028-02-01', '2028-02-29').dias).toBe(29); // bisiesto
  });

  it(`acepta hasta ${DIAS_MAXIMOS_RANGO} días y rechaza uno más`, () => {
    expect(armarRango('2026-06-24', '2026-09-23').dias).toBe(
      DIAS_MAXIMOS_RANGO,
    );
    expect(() => armarRango('2026-06-23', '2026-09-23')).toThrow(
      BadRequestException,
    );
  });

  it('rechaza desde posterior a hasta', () => {
    expect(() => armarRango('2026-09-23', '2026-09-22')).toThrow(
      BadRequestException,
    );
  });

  it('rechaza fechas que no existen (en vez de correrlas al mes siguiente)', () => {
    expect(() => armarRango('2026-13-01')).toThrow(BadRequestException);
    expect(() => armarRango('2026-02-30')).toThrow(BadRequestException);
    expect(() => armarRango('2027-02-29')).toThrow(BadRequestException);
  });
});
