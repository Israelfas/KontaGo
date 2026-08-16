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
  activo: boolean;
}

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioVentaCentavos: number;
  costoUnitarioCentavos: number;
}

export interface Venta {
  id: string;
  totalCentavos: number;
  montoRecibidoCentavos: number;
  vueltoCentavos: number;
  items: VentaItem[];
  createdAt: string;
}

export interface ResumenDelDia {
  fecha: string;
  cantidadVentas: number;
  ingresoBrutoCentavos: number;
  gananciaCentavos: number;
}
