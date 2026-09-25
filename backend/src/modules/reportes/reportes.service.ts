import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { Tenant } from '../tenants/entities/tenant.entity';
import { VentasService } from '../ventas/ventas.service';
import { InventarioService } from '../inventario/inventario.service';
import { CajaService } from '../caja/caja.service';
import { ProductosService } from '../productos/productos.service';
import { RangoFechas } from '../ventas/rango-fechas';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { MetodoPago } from '../../common/enums/metodo-pago.enum';
import { MotivoMerma } from '../../common/enums/motivo-merma.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import { TipoMovimientoCaja } from '../caja/entities/movimiento-caja.entity';
import { importeCentavos, restar } from '../../common/cantidad';
import { agregarGraficos, rangoDe, type GraficoExcel } from './graficos-excel';

// Colores de KontaGo (sin el #, como los pide Excel).
const TINTA = 'FF1C2B3A';
const PAPEL = 'FFF6F3EC';
const LINEA = 'FFE4DDC9';

// Montos en dólares con dos decimales; los negativos en rojo.
const DINERO = '"$"#,##0.00;[Red]-"$"#,##0.00';
// Cantidades: 3 si es entera, 0,5 si es media libra (sin ceros de más).
const CANTIDAD = 'General';
const FECHA = 'dd/mm/yyyy';
const HORA = 'hh:mm';
const FECHA_HORA = 'dd/mm/yyyy hh:mm';

const PAGO: Record<MetodoPago, string> = {
  [MetodoPago.EFECTIVO]: 'Efectivo',
  [MetodoPago.TRANSFERENCIA]: 'Transferencia',
  [MetodoPago.FIADO]: 'Fiado',
};
const MOTIVO: Record<MotivoMerma, string> = {
  [MotivoMerma.VENCIDO]: 'Vencido',
  [MotivoMerma.DANADO]: 'Dañado',
  [MotivoMerma.ROBADO]: 'Robado',
  [MotivoMerma.OTRO]: 'Otro',
};

/** Centavos → dólares, para que Excel sume números y no texto. */
const dolares = (centavos: number) => centavos / 100;

/**
 * Excel no tiene zonas horarias: guarda la fecha "de pared". Se pasa la
 * hora local del servidor (Ecuador) como si fuera UTC, así en la planilla
 * se lee 14:05 y no 19:05.
 */
function deParedLocal(fecha: Date): Date {
  return new Date(
    Date.UTC(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      fecha.getHours(),
      fecha.getMinutes(),
      fecha.getSeconds(),
    ),
  );
}

/** 'AAAA-MM-DD' → fecha de Excel (sin hora). */
function deCalendario(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

interface Columna<T> {
  titulo: string;
  ancho: number;
  valor: (fila: T) => string | number | Date | null;
  formato?: string;
  /** Suma al pie (solo columnas de números). */
  total?: boolean;
}

/**
 * Una hoja de datos: encabezado fijo con filtros, una fila por registro y,
 * si hay columnas para sumar, una fila de totales con fórmulas (el
 * contador puede filtrar y rehacer cuentas sin tocar nada).
 */
function hojaDeDatos<T>(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: Columna<T>[],
  filas: T[],
) {
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  hoja.columns = columnas.map((c) => ({
    header: c.titulo,
    width: c.ancho,
    style: c.formato ? { numFmt: c.formato } : {},
  }));
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: PAPEL } };
  encabezado.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: TINTA },
  };
  encabezado.alignment = { vertical: 'middle' };
  encabezado.height = 22;

  for (const fila of filas) hoja.addRow(columnas.map((c) => c.valor(fila)));

  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + filas.length, column: columnas.length },
    };
  }

  if (columnas.some((c) => c.total)) {
    const ultima = 1 + filas.length;
    const pie = hoja.addRow(
      columnas.map((c, i) => {
        if (i === 0) return 'Total';
        if (!c.total) return null;
        const letra = hoja.getColumn(i + 1).letter;
        const resultado = filas.reduce(
          (acc, f) => acc + Number(c.valor(f) ?? 0),
          0,
        );
        return filas.length
          ? {
              formula: `SUM(${letra}2:${letra}${ultima})`,
              // Redondeado a centavos: sumar dólares con decimales arrastra
              // restos de coma flotante (6568.720000000009).
              result: Math.round(resultado * 100) / 100,
            }
          : 0;
      }),
    );
    pie.font = { bold: true };
    pie.border = { top: { style: 'thin', color: { argb: TINTA } } };
  }
  return hoja;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly ventas: VentasService,
    private readonly inventario: InventarioService,
    private readonly caja: CajaService,
    private readonly productos: ProductosService,
  ) {}

  /**
   * El reporte del período para el contador: un .xlsx con el resumen y el
   * detalle de ventas, caja e inventario. Los números salen de los mismos
   * servicios que las pantallas, así coinciden con lo que se ve en la app.
   */
  async excel(user: AuthenticatedUser, rango: RangoFechas) {
    const { tenantId } = user;
    const [
      tienda,
      resumen,
      resumenInventario,
      ventas,
      movimientos,
      turnos,
      productos,
    ] = await Promise.all([
      this.tenants.findOneByOrFail({ id: tenantId }),
      this.ventas.obtenerResumen(tenantId, rango),
      this.inventario.resumenDelPeriodo(tenantId, rango),
      this.ventas.ventasDelPeriodo(tenantId, rango),
      this.inventario.listarMovimientos(tenantId, rango, { limite: 100_000 }),
      this.caja.listar(user, rango),
      this.productos.listar(tenantId),
    ]);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'KontaGo';
    libro.created = new Date();
    // Que Excel recalcule las sumas al abrir (por si alguien filtra o edita).
    libro.calcProperties.fullCalcOnLoad = true;

    // --- Resumen ---
    const hoja = libro.addWorksheet('Resumen');
    hoja.columns = [{ width: 34 }, { width: 18 }];
    const titulo = hoja.addRow([tienda.nombre]);
    titulo.font = { bold: true, size: 16, color: { argb: TINTA } };
    const datosTienda = [
      tienda.razonSocial,
      tienda.ruc ? `RUC ${tienda.ruc}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (datosTienda)
      hoja.addRow([datosTienda]).font = { color: { argb: 'FF4C5C6B' } };
    hoja.addRow([
      `Del ${rango.desde.split('-').reverse().join('/')} al ${rango.hasta.split('-').reverse().join('/')}`,
    ]).font = { color: { argb: 'FF4C5C6B' } };
    hoja.addRow([]);

    const seccion = (nombre: string) => {
      const fila = hoja.addRow([nombre]);
      fila.font = { bold: true, color: { argb: PAPEL } };
      fila.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: TINTA },
      };
      hoja.getCell(`B${fila.number}`).fill = fila.fill;
    };
    const dato = (etiqueta: string, valor: number, formato = DINERO) => {
      const fila = hoja.addRow([etiqueta, valor]);
      fila.getCell(2).numFmt = formato;
      fila.border = { bottom: { style: 'hair', color: { argb: LINEA } } };
    };

    seccion('Ventas');
    dato('Ventas', resumen.cantidadVentas, '0');
    dato('Cobrado (con IVA)', dolares(resumen.ingresoBrutoCentavos));
    dato('IVA incluido', dolares(resumen.ivaCentavos));
    dato(
      'Base imponible (sin IVA)',
      dolares(resumen.ingresoBrutoCentavos - resumen.ivaCentavos),
    );
    dato('Ganancia', dolares(resumen.gananciaCentavos));
    dato('Anulado', dolares(resumen.anuladoCentavos));
    dato('En efectivo', dolares(resumen.efectivoCentavos));
    dato('Por transferencia', dolares(resumen.transferenciaCentavos));
    dato('Al fiado (por cobrar)', dolares(resumen.fiadoCentavos));
    hoja.addRow([]);

    seccion('Inventario');
    dato(
      'Compras de mercadería',
      resumenInventario.cantidadAbastecimientos,
      '0',
    );
    dato('Gastado en mercadería', dolares(resumenInventario.egresoCentavos));
    dato('Mermas', resumenInventario.cantidadMermas, '0');
    dato('Perdido en mermas', dolares(resumenInventario.perdidaCentavos));
    hoja.addRow([]);

    const cerrados = turnos.filter((t) => t.estado === 'cerrado');
    seccion('Caja');
    dato('Cierres de caja', cerrados.length, '0');
    dato(
      'Diferencia total (sobra + / falta −)',
      dolares(
        cerrados.reduce((acc, t) => acc + (t.diferenciaCentavos ?? 0), 0),
      ),
    );
    hoja.addRow([]);
    hoja.addRow([
      `Generado por KontaGo el ${new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}. El ticket no reemplaza a la factura electrónica.`,
    ]).font = { italic: true, size: 9, color: { argb: 'FF4C5C6B' } };

    // --- Gráficos ---
    // Los datos van en tablitas a la izquierda y cada gráfico al lado, leyendo
    // de esas celdas (así, si alguien corrige un número, el gráfico cambia).
    const graficos: GraficoExcel[] = [];
    const HOJA_GRAFICOS = 'Gráficos';
    const hojaGraficos = libro.addWorksheet(HOJA_GRAFICOS);
    hojaGraficos.columns = [{ width: 28 }, { width: 14 }];
    hojaGraficos.addRow([
      `Estadísticas del ${rango.desde.split('-').reverse().join('/')} al ${rango.hasta.split('-').reverse().join('/')}`,
    ]).font = {
      bold: true,
      size: 14,
      color: { argb: TINTA },
    };
    // Cada bloque ocupa lo mismo: el alto del gráfico (o la tabla, si es más larga).
    const ALTO_BLOQUE = 18;
    let filaBloque = 3;
    const bloque = (
      tipo: GraficoExcel['tipo'],
      tituloGrafico: string,
      encabezado: [string, string],
      filas: [string, number][],
      opciones: { color?: string; colores?: string[]; formato?: string } = {},
    ) => {
      if (filas.length === 0) return;
      const formato = opciones.formato ?? DINERO;
      const inicio = filaBloque;
      hojaGraficos.getCell(`A${inicio}`).value = tituloGrafico;
      hojaGraficos.getCell(`A${inicio}`).font = {
        bold: true,
        color: { argb: TINTA },
      };
      const cabecera = hojaGraficos.getRow(inicio + 1);
      cabecera.values = encabezado;
      cabecera.font = { bold: true, color: { argb: PAPEL } };
      cabecera.eachCell((celda) => {
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: TINTA },
        };
      });
      filas.forEach(([etiqueta, valor], i) => {
        const fila = hojaGraficos.getRow(inicio + 2 + i);
        fila.values = [etiqueta, valor];
        fila.getCell(2).numFmt = formato;
      });
      const primera = inicio + 2;
      const ultima = inicio + 1 + filas.length;
      graficos.push({
        tipo,
        titulo: tituloGrafico,
        hoja: HOJA_GRAFICOS,
        categorias: {
          rango: rangoDe(HOJA_GRAFICOS, 'A', primera, ultima),
          valores: filas.map(([etiqueta]) => etiqueta),
        },
        series: [
          {
            nombre: encabezado[1],
            rango: rangoDe(HOJA_GRAFICOS, 'B', primera, ultima),
            valores: filas.map(([, valor]) => valor),
            color: opciones.color ?? 'D98C2B',
          },
        ],
        formato,
        coloresPorcion: opciones.colores,
        // De la columna D a la L, a la altura de su tabla.
        desde: [3, inicio - 1],
        hasta: [11, inicio - 1 + ALTO_BLOQUE - 1],
      });
      filaBloque += Math.max(ALTO_BLOQUE, filas.length + 4);
    };

    const porHora = resumen.agrupadoPor === 'hora';
    const serie = resumen.serie.map(
      (p) => [p.etiqueta, dolares(p.centavos)] as [string, number],
    );
    if (serie.some(([, v]) => v !== 0)) {
      bloque(
        serie.length > 31 ? 'linea' : 'columnas',
        porHora ? 'Ventas por hora' : 'Ventas por día',
        [porHora ? 'Hora' : 'Día', 'Cobrado'],
        serie,
      );
    }
    const pagos = (
      [
        ['Efectivo', resumen.efectivoCentavos, '1C2B3A'],
        ['Transferencia', resumen.transferenciaCentavos, 'D98C2B'],
        ['Fiado', resumen.fiadoCentavos, '2F6F4F'],
      ] as const
    ).filter(([, centavos]) => centavos > 0);
    bloque(
      'dona',
      'Cómo pagan',
      ['Forma de pago', 'Cobrado'],
      pagos.map(([nombre, centavos]) => [nombre, dolares(centavos)]),
      { colores: pagos.map(([, , color]) => color) },
    );
    bloque(
      'barras',
      'Lo más vendido',
      ['Producto', 'Cobrado'],
      resumen.topProductos.map((p) => [p.nombre, dolares(p.centavos)]),
      { color: '2F6F4F' },
    );
    bloque(
      'barras',
      'Por qué se pierde mercadería',
      ['Motivo', 'Perdido'],
      resumenInventario.perdidaPorMotivo
        .filter((m) => m.centavos > 0)
        .map((m) => [MOTIVO[m.motivo], dolares(m.centavos)]),
      { color: 'B6462F' },
    );
    bloque(
      'barras',
      'Lo que más se pierde',
      ['Producto', 'Perdido'],
      resumenInventario.productosConMasPerdida
        .filter((p) => p.centavos > 0)
        .map((p) => [p.nombre, dolares(p.centavos)]),
      { color: 'B6462F' },
    );
    if (graficos.length === 0) {
      hojaGraficos.addRow([]);
      hojaGraficos.addRow([
        'Todavía no hay ventas ni pérdidas en este período para graficar.',
      ]);
    }

    // --- Ventas ---
    type FilaVenta = (typeof ventas)[number];
    hojaDeDatos<FilaVenta>(
      libro,
      'Ventas',
      [
        { titulo: 'Ticket', ancho: 9, valor: (v) => v.numero, formato: '0' },
        {
          titulo: 'Fecha',
          ancho: 12,
          valor: (v) => deParedLocal(v.createdAt),
          formato: FECHA,
        },
        {
          titulo: 'Hora',
          ancho: 8,
          valor: (v) => deParedLocal(v.createdAt),
          formato: HORA,
        },
        { titulo: 'Cajero', ancho: 22, valor: (v) => v.usuario?.nombre ?? '' },
        { titulo: 'Pago', ancho: 14, valor: (v) => PAGO[v.metodoPago] },
        {
          titulo: 'Total',
          ancho: 12,
          valor: (v) => dolares(v.totalCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Anulado',
          ancho: 12,
          valor: (v) => dolares(v.totalAnuladoCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Cobrado',
          ancho: 12,
          valor: (v) => dolares(v.totalCentavos - v.totalAnuladoCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'IVA',
          ancho: 11,
          valor: (v) => dolares(this.ventas.calcularIvaCentavos(v)),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Ganancia',
          ancho: 12,
          valor: (v) => dolares(this.ventas.calcularGananciaCentavos(v)),
          formato: DINERO,
          total: true,
        },
      ],
      ventas,
    );

    // --- Productos vendidos (una fila por línea de cada venta) ---
    const lineas = ventas.flatMap((venta) =>
      venta.items.map((item) => ({ venta, item })),
    );
    type FilaLinea = (typeof lineas)[number];
    const vendidas = ({ item }: FilaLinea) =>
      restar(item.cantidad, item.cantidadAnulada);
    hojaDeDatos<FilaLinea>(
      libro,
      'Productos vendidos',
      [
        {
          titulo: 'Fecha',
          ancho: 12,
          valor: (l) => deParedLocal(l.venta.createdAt),
          formato: FECHA,
        },
        {
          titulo: 'Ticket',
          ancho: 9,
          valor: (l) => l.venta.numero,
          formato: '0',
        },
        {
          titulo: 'Código',
          ancho: 16,
          valor: (l) => l.item.producto?.codigoBarras ?? '',
        },
        {
          titulo: 'Producto',
          ancho: 30,
          valor: (l) => l.item.producto?.nombre ?? '',
        },
        {
          titulo: 'Categoría',
          ancho: 16,
          valor: (l) => l.item.producto?.categoria ?? '',
        },
        {
          titulo: 'Vendidas',
          ancho: 10,
          valor: vendidas,
          formato: CANTIDAD,
          total: true,
        },
        {
          titulo: 'Anuladas',
          ancho: 10,
          valor: (l) => l.item.cantidadAnulada,
          formato: CANTIDAD,
          total: true,
        },
        {
          titulo: 'Precio unitario',
          ancho: 14,
          valor: (l) => dolares(l.item.precioVentaCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Total',
          ancho: 12,
          valor: (l) =>
            dolares(
              importeCentavos(l.item.precioVentaCentavos, l.item.cantidad) -
                importeCentavos(
                  l.item.precioVentaCentavos,
                  l.item.cantidadAnulada,
                ),
            ),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'IVA',
          ancho: 11,
          valor: (l) => dolares(l.item.ivaCentavos - l.item.ivaAnuladoCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Costo unitario',
          ancho: 14,
          valor: (l) => dolares(l.item.costoUnitarioCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Ganancia',
          ancho: 12,
          valor: (l) =>
            dolares(this.ventas.calcularGananciaDeLineaCentavos(l.item)),
          formato: DINERO,
          total: true,
        },
      ],
      lineas,
    );

    // --- Caja ---
    type FilaTurno = (typeof turnos)[number];
    const turnosEnOrden = [...turnos].reverse();
    hojaDeDatos<FilaTurno>(
      libro,
      'Caja',
      [
        { titulo: 'Cajero', ancho: 22, valor: (t) => t.cajero },
        {
          titulo: 'Abrió',
          ancho: 17,
          valor: (t) => deParedLocal(new Date(t.abiertoEn)),
          formato: FECHA_HORA,
        },
        {
          titulo: 'Cerró',
          ancho: 17,
          valor: (t) =>
            t.cerradoEn ? deParedLocal(new Date(t.cerradoEn)) : null,
          formato: FECHA_HORA,
        },
        {
          titulo: 'Estado',
          ancho: 10,
          valor: (t) => (t.estado === 'cerrado' ? 'Cerrada' : 'Abierta'),
        },
        {
          titulo: 'Fondo inicial',
          ancho: 13,
          valor: (t) => dolares(t.fondoInicialCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Ventas',
          ancho: 9,
          valor: (t) => t.cantidadVentas,
          formato: '0',
          total: true,
        },
        {
          titulo: 'Ventas en efectivo',
          ancho: 16,
          valor: (t) => dolares(t.ventasEfectivoCentavos ?? 0),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Transferencias',
          ancho: 14,
          valor: (t) => dolares(t.ventasTransferenciaCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Ingresos',
          ancho: 11,
          valor: (t) => dolares(t.ingresosCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Retiros',
          ancho: 11,
          valor: (t) => dolares(t.retirosCentavos),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Debería haber',
          ancho: 14,
          valor: (t) => dolares(t.efectivoEsperadoCentavos ?? 0),
          formato: DINERO,
        },
        {
          titulo: 'Contó',
          ancho: 12,
          valor: (t) =>
            t.efectivoContadoCentavos === undefined
              ? null
              : dolares(t.efectivoContadoCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Diferencia',
          ancho: 12,
          valor: (t) =>
            t.diferenciaCentavos === undefined
              ? null
              : dolares(t.diferenciaCentavos),
          formato: DINERO,
          total: true,
        },
        { titulo: 'Cerrada por', ancho: 20, valor: (t) => t.cerradoPor ?? '' },
        { titulo: 'Nota', ancho: 30, valor: (t) => t.nota ?? '' },
      ],
      turnosEnOrden,
    );

    const movimientosCaja = turnosEnOrden.flatMap((t) =>
      t.movimientos.map((m) => ({ ...m, cajero: t.cajero })),
    );
    type FilaMovCaja = (typeof movimientosCaja)[number];
    hojaDeDatos<FilaMovCaja>(
      libro,
      'Movimientos de caja',
      [
        {
          titulo: 'Fecha',
          ancho: 17,
          valor: (m) => deParedLocal(new Date(m.createdAt)),
          formato: FECHA_HORA,
        },
        { titulo: 'Caja de', ancho: 22, valor: (m) => m.cajero },
        {
          titulo: 'Tipo',
          ancho: 10,
          valor: (m) =>
            m.tipo === TipoMovimientoCaja.RETIRO ? 'Retiro' : 'Ingreso',
        },
        {
          titulo: 'Monto',
          ancho: 12,
          // Los retiros restan: así la suma da lo que cambió el cajón.
          valor: (m) =>
            dolares(
              m.tipo === TipoMovimientoCaja.RETIRO
                ? -m.montoCentavos
                : m.montoCentavos,
            ),
          formato: DINERO,
          total: true,
        },
        { titulo: 'Motivo', ancho: 34, valor: (m) => m.motivo },
        { titulo: 'Registró', ancho: 22, valor: (m) => m.usuario },
      ],
      movimientosCaja,
    );

    // --- Inventario ---
    const movs = [...movimientos.movimientos].reverse();
    type FilaMov = (typeof movs)[number];
    const esCompra = (m: FilaMov) =>
      m.tipo === TipoMovimientoInventario.ABASTECIMIENTO;
    hojaDeDatos<FilaMov>(
      libro,
      'Compras y mermas',
      [
        {
          titulo: 'Fecha',
          ancho: 17,
          valor: (m) => deParedLocal(new Date(m.createdAt)),
          formato: FECHA_HORA,
        },
        {
          titulo: 'Tipo',
          ancho: 12,
          valor: (m) => (esCompra(m) ? 'Compra' : 'Merma'),
        },
        { titulo: 'Producto', ancho: 30, valor: (m) => m.producto.nombre },
        {
          titulo: 'Cantidad',
          ancho: 10,
          valor: (m) => m.cantidad,
          formato: CANTIDAD,
        },
        {
          titulo: 'Costo unitario',
          ancho: 14,
          valor: (m) => dolares(m.costoUnitarioCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Compras',
          ancho: 12,
          valor: (m) => (esCompra(m) ? dolares(m.totalCentavos) : null),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Pérdida',
          ancho: 12,
          valor: (m) => (esCompra(m) ? null : dolares(m.totalCentavos)),
          formato: DINERO,
          total: true,
        },
        { titulo: 'Proveedor', ancho: 20, valor: (m) => m.proveedor ?? '' },
        {
          titulo: 'Motivo',
          ancho: 12,
          valor: (m) => (m.motivo ? MOTIVO[m.motivo] : ''),
        },
        {
          titulo: 'Vence',
          ancho: 12,
          valor: (m) =>
            m.vencimientoLote ? deCalendario(m.vencimientoLote) : null,
          formato: FECHA,
        },
        { titulo: 'Registró', ancho: 22, valor: (m) => m.registradoPor },
      ],
      movs,
    );

    // --- Stock (al momento de descargar) ---
    type FilaProducto = (typeof productos)[number];
    const hojaStock = hojaDeDatos<FilaProducto>(
      libro,
      'Stock actual',
      [
        { titulo: 'Código', ancho: 16, valor: (p) => p.codigoBarras },
        { titulo: 'Producto', ancho: 30, valor: (p) => p.nombre },
        { titulo: 'Categoría', ancho: 16, valor: (p) => p.categoria ?? '' },
        { titulo: 'Proveedor', ancho: 20, valor: (p) => p.proveedor ?? '' },
        {
          titulo: 'Precio de venta',
          ancho: 14,
          valor: (p) => dolares(p.precioVentaCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Costo',
          ancho: 12,
          valor: (p) => dolares(p.costoUnitarioCentavos),
          formato: DINERO,
        },
        {
          titulo: 'Stock',
          ancho: 9,
          valor: (p) => p.stock,
          formato: CANTIDAD,
          total: true,
        },
        {
          titulo: 'Stock mínimo',
          ancho: 12,
          valor: (p) => p.stockMinimo,
          formato: CANTIDAD,
        },
        {
          titulo: 'Valor al costo',
          ancho: 14,
          valor: (p) =>
            dolares(importeCentavos(p.costoUnitarioCentavos, p.stock)),
          formato: DINERO,
          total: true,
        },
        {
          titulo: 'Estado',
          ancho: 12,
          valor: (p) =>
            p.stockMinimo > 0 && p.stock <= p.stockMinimo ? 'Stock bajo' : '',
        },
      ],
      productos,
    );
    hojaStock.headerFooter.oddHeader =
      '&LStock al momento de descargar el reporte';

    const nombre = `kontago-${aNombreDeArchivo(tienda.nombre)}-${rango.desde}-a-${rango.hasta}.xlsx`;
    const contenido = await agregarGraficos(
      Buffer.from(await libro.xlsx.writeBuffer()),
      graficos,
    );
    return { nombre, contenido };
  }
}

/** 'Minimarket La Esquina' → 'minimarket-la-esquina'. */
function aNombreDeArchivo(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tienda'
  );
}
