import {
  fechaMasProxima,
  ordenFEFO,
  planDeConsumo,
  planDeDevolucion,
  type LoteFEFO,
} from './lotes';

const lote = (
  id: string,
  fechaVencimiento: string | null,
  cantidad: number,
  creado = '2026-09-01T10:00:00Z',
): LoteFEFO => ({
  id,
  fechaVencimiento,
  cantidad,
  createdAt: new Date(creado),
});

describe('ordenFEFO', () => {
  it('primero lo que vence antes, los sin fecha al final', () => {
    const lotes = [
      lote('sin', null, 5),
      lote('oct', '2026-10-05', 5),
      lote('sep', '2026-09-28', 5),
    ];
    expect(lotes.sort(ordenFEFO).map((l) => l.id)).toEqual([
      'sep',
      'oct',
      'sin',
    ]);
  });

  it('a igual fecha, el que llegó primero', () => {
    const lotes = [
      lote('nuevo', '2026-09-28', 5, '2026-09-20T10:00:00Z'),
      lote('viejo', '2026-09-28', 5, '2026-09-10T10:00:00Z'),
    ];
    expect(lotes.sort(ordenFEFO).map((l) => l.id)).toEqual(['viejo', 'nuevo']);
  });
});

describe('planDeConsumo', () => {
  const lotes = [
    lote('oct', '2026-10-05', 12),
    lote('sep', '2026-09-28', 3),
    lote('sin', null, 4),
  ];

  it('saca del que vence antes', () => {
    expect(planDeConsumo(lotes, 2)).toEqual([{ loteId: 'sep', cantidad: 2 }]);
  });

  it('si no alcanza, sigue con el siguiente', () => {
    expect(planDeConsumo(lotes, 5)).toEqual([
      { loteId: 'sep', cantidad: 3 },
      { loteId: 'oct', cantidad: 2 },
    ]);
  });

  it('los sin fecha salen últimos', () => {
    expect(planDeConsumo(lotes, 17)).toEqual([
      { loteId: 'sep', cantidad: 3 },
      { loteId: 'oct', cantidad: 12 },
      { loteId: 'sin', cantidad: 2 },
    ]);
  });

  it('salta los agotados', () => {
    expect(
      planDeConsumo(
        [lote('vacio', '2026-09-01', 0), lote('ok', '2026-09-30', 2)],
        1,
      ),
    ).toEqual([{ loteId: 'ok', cantidad: 1 }]);
  });

  it('si los lotes no alcanzan, saca lo que hay', () => {
    expect(planDeConsumo([lote('a', '2026-09-28', 2)], 5)).toEqual([
      { loteId: 'a', cantidad: 2 },
    ]);
  });
});

describe('planDeDevolucion', () => {
  // Se vendieron 5: 3 del lote de septiembre y 2 del de octubre.
  const consumos = [
    { id: 'c-sep', cantidad: 3, cantidadDevuelta: 0 },
    { id: 'c-oct', cantidad: 2, cantidadDevuelta: 0 },
  ];

  it('devuelve primero al último lote consumido', () => {
    expect(planDeDevolucion(consumos, 1)).toEqual({
      plan: [{ consumoId: 'c-oct', cantidad: 1 }],
      sinLote: 0,
    });
  });

  it('anular todo devuelve cada unidad a su lote', () => {
    expect(planDeDevolucion(consumos, 5)).toEqual({
      plan: [
        { consumoId: 'c-oct', cantidad: 2 },
        { consumoId: 'c-sep', cantidad: 3 },
      ],
      sinLote: 0,
    });
  });

  it('no devuelve dos veces lo ya devuelto', () => {
    const yaAnulado = [
      { id: 'c-sep', cantidad: 3, cantidadDevuelta: 0 },
      { id: 'c-oct', cantidad: 2, cantidadDevuelta: 2 },
    ];
    expect(planDeDevolucion(yaAnulado, 2)).toEqual({
      plan: [{ consumoId: 'c-sep', cantidad: 2 }],
      sinLote: 0,
    });
  });

  it('una venta de antes de los lotes queda sin lote', () => {
    expect(planDeDevolucion([], 3)).toEqual({ plan: [], sinLote: 3 });
  });
});

describe('fechaMasProxima', () => {
  it('la del lote con unidades que vence antes', () => {
    expect(
      fechaMasProxima([
        lote('agotado', '2026-09-20', 0),
        lote('oct', '2026-10-05', 4),
        lote('sep', '2026-09-28', 1),
        lote('sin', null, 9),
      ]),
    ).toBe('2026-09-28');
  });

  it('null si solo quedan unidades sin fecha', () => {
    expect(fechaMasProxima([lote('sin', null, 3)])).toBeNull();
  });
});
