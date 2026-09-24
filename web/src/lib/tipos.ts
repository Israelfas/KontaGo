export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface Producto {
  id: string;
  tenantId: string;
  codigoBarras: string;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  precioVentaCentavos: number;
  costoUnitarioCentavos: number;
  stock: number;
  stockMinimo: number;
  // Con lotes: la fecha del lote que vence antes.
  fechaVencimiento: string | null;
  ivaExento: boolean;
  activo: boolean;
  // Lotes con unidades, del que vence antes al último (vacío si el
  // producto no vence). Viene en el listado y en las alertas.
  lotes?: Lote[];
}

// Unidades de un producto que vencen el mismo día. La suma de los lotes
// de un producto es su stock.
export interface Lote {
  id: string;
  fechaVencimiento: string | null; // null = sin fecha conocida
  cantidad: number;
  cantidadInicial: number;
}

export interface UsuarioEquipo {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'cajero';
  activo: boolean;
  createdAt: string;
  // Bloqueada por intentos fallidos hasta esta hora (null si no lo está).
  bloqueadoHasta: string | null;
  // Solo viene en la lista del equipo.
  ultimoIngreso?: string | null;
}

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioVentaCentavos: number;
  costoUnitarioCentavos: number;
  ivaCentavos: number;
}

// Solo el efectivo entra al cajón (y al arqueo de caja).
export type MetodoPago = 'efectivo' | 'transferencia';

export interface Venta {
  id: string;
  numero: number; // de ticket: 1, 2, 3… por tienda
  totalCentavos: number;
  metodoPago: MetodoPago;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  items: VentaItem[];
  createdAt: string;
  // totalCentavos ya incluye IVA. Estos dos son el desglose (base
  // imponible + IVA), calculados por el backend a partir de los items.
  ivaCentavos: number;
  subtotalCentavos: number;
}

export interface ResumenDelDia {
  fecha: string;
  cantidadVentas: number;
  ingresoBrutoCentavos: number;
  gananciaCentavos: number;
  ivaCentavos: number;
  anuladoCentavos: number; // devuelto por anulaciones, ya descontado de lo anterior
}

/** Un punto del gráfico: una hora ('8'…'23') o un día ('AAAA-MM-DD'). */
export interface PuntoSerie {
  etiqueta: string;
  centavos: number;
}

export interface ProductoVendido {
  nombre: string;
  unidades: number;
  centavos: number;
}

// GET /ventas/resumen?desde&hasta (solo admin).
export interface ResumenPeriodo extends ResumenDelDia {
  desde: string;
  hasta: string;
  dias: number;
  // Lo cobrado (neto de anulaciones) según cómo se pagó.
  efectivoCentavos: number;
  transferenciaCentavos: number;
  // Un día se grafica por hora; un rango, por día.
  agrupadoPor: 'hora' | 'dia';
  serie: PuntoSerie[];
  topProductos: ProductoVendido[];
}

export interface PaginaDeVentas {
  ventas: VentaDelHistorial[];
  total: number;
}

// Venta tal como la devuelve GET /ventas/hoy (sin costos: la ve también
// el cajero).
export interface VentaDelHistorial {
  id: string;
  numero: number; // de ticket: 1, 2, 3… por tienda
  createdAt: string;
  vendedor: string;
  totalCentavos: number;
  totalAnuladoCentavos: number;
  metodoPago: MetodoPago;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  estado: 'completa' | 'parcialmente_anulada' | 'anulada';
  items: {
    id: string;
    productoId: string;
    nombre: string;
    codigoBarras: string;
    cantidad: number;
    cantidadAnulada: number;
    precioVentaCentavos: number;
  }[];
  anulaciones: {
    id: string;
    createdAt: string;
    anuladoPor: string;
    motivo: string;
    montoDevueltoCentavos: number;
  }[];
}

// --- Inventario (Fase 2) ---

export type TipoMovimientoInventario = 'abastecimiento' | 'merma';

export type MotivoMerma = 'vencido' | 'danado' | 'robado' | 'otro';

export const ETIQUETAS_MOTIVO_MERMA: Record<MotivoMerma, string> = {
  vencido: 'Vencido',
  danado: 'Dañado',
  robado: 'Robado',
  otro: 'Otro',
};

export interface MovimientoInventario {
  id: string;
  productoId: string;
  usuarioId: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  costoUnitarioCentavos: number;
  proveedor: string | null;
  motivo: MotivoMerma | null;
  createdAt: string;
}

export interface ResumenMovimientosDelDia {
  fecha: string;
  egresoCentavos: number;
  perdidaCentavos: number;
  cantidadAbastecimientos: number;
  cantidadMermas: number;
}

export interface AlertasProductos {
  stockBajo: Producto[];
  porVencer: Producto[]; // con algún lote que vence en los próximos días
  vencidos: Producto[]; // con algún lote ya vencido (hay que darlo de baja)
}

// --- Caja (turnos y arqueo) ---

export type TipoMovimientoCaja = 'retiro' | 'ingreso';

export interface MovimientoCaja {
  id: string;
  tipo: TipoMovimientoCaja;
  montoCentavos: number;
  motivo: string;
  usuario: string;
  createdAt: string;
}

// Un turno de caja: lo abre un cajero con el fondo inicial y lo cierra
// contando el efectivo.
export interface TurnoCaja {
  id: string;
  estado: 'abierto' | 'cerrado';
  cajero: string;
  usuarioId: string;
  abiertoEn: string;
  cerradoEn: string | null;
  cerradoPor: string | null;
  fondoInicialCentavos: number;
  cantidadVentas: number;
  ventasTransferenciaCentavos: number;
  ingresosCentavos: number;
  retirosCentavos: number;
  // Conteo a ciegas: el cajero no los recibe mientras su caja está abierta.
  ventasEfectivoCentavos?: number;
  efectivoEsperadoCentavos?: number;
  // Solo cerrado. diferencia = contado − esperado (negativa = falta).
  efectivoContadoCentavos?: number;
  diferenciaCentavos?: number;
  nota: string | null;
  movimientos: MovimientoCaja[];
}

// --- Ticket (GET /ventas/:id/ticket) ---

// Datos de la tienda que salen en el ticket (los edita el admin).
export interface Tienda {
  nombre: string;
  razonSocial: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  mensajeTicket: string | null; // pie del ticket
}

// La venta como se imprime o se comparte. No es la factura del SRI.
export interface Ticket {
  tienda: Tienda;
  numero: number;
  fecha: string;
  cajero: string;
  metodoPago: MetodoPago;
  lineas: {
    nombre: string;
    cantidad: number;
    precioUnitarioCentavos: number;
    totalCentavos: number;
    cantidadAnulada: number;
  }[];
  // Desglose como en Ecuador: suman el total.
  subtotalConIvaCentavos: number;
  subtotalSinIvaCentavos: number;
  ivaCentavos: number;
  tarifaIva: number; // %, ej. 15
  totalCentavos: number;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  anuladoCentavos: number;
}

// --- Historial de inventario (solo admin) ---

// Un abastecimiento o una merma.
export interface MovimientoDelHistorial {
  id: string;
  tipo: TipoMovimientoInventario;
  createdAt: string;
  producto: { id: string; nombre: string };
  cantidad: number;
  // Abastecimiento: lo que costó esa compra. Merma: el costo en ese momento.
  costoUnitarioCentavos: number;
  totalCentavos: number;
  proveedor: string | null;
  motivo: MotivoMerma | null;
  vencimientoLote: string | null; // 'AAAA-MM-DD'
  registradoPor: string;
}

export interface PaginaDeMovimientos {
  movimientos: MovimientoDelHistorial[];
  total: number;
}

export interface ResumenInventarioPeriodo {
  desde: string;
  hasta: string;
  dias: number;
  egresoCentavos: number;
  cantidadAbastecimientos: number;
  perdidaCentavos: number;
  cantidadMermas: number;
  perdidaPorMotivo: { motivo: MotivoMerma; unidades: number; centavos: number }[];
  porProveedor: { proveedor: string | null; compras: number; centavos: number }[];
  productosConMasPerdida: { nombre: string; unidades: number; centavos: number }[];
}
