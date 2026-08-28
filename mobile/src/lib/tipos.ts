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
  fechaVencimiento: string | null;
  ivaExento: boolean;
  activo: boolean;
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
  porVencer: Producto[];
}