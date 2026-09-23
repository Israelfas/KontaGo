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
}

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioVentaCentavos: number;
  costoUnitarioCentavos: number;
  ivaCentavos: number;
}

export interface Venta {
  id: string;
  totalCentavos: number;
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
  createdAt: string;
  vendedor: string;
  totalCentavos: number;
  totalAnuladoCentavos: number;
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