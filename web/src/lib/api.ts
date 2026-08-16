import type { Producto, ResumenDelDia, TokenPair, Venta } from './tipos';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrapper central de fetch. Todas las llamadas al backend pasan por acá,
 * así el manejo de errores, el header de auth y la base URL están en un
 * solo lugar.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...resto } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    // El backend siempre devuelve { message, error, statusCode } en errores.
    const body = await response.json().catch(() => null);
    const mensaje = Array.isArray(body?.message)
      ? body.message.join(', ') // errores de validación vienen como array
      : (body?.message ?? `Error ${response.status}`);
    throw new ApiError(mensaje, response.status);
  }

  // Algunos endpoints (204) no devuelven body.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Auth ---

export function login(email: string, password: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface RegistroInput {
  nombreTienda: string;
  nombreAdmin: string;
  email: string;
  password: string;
  moneda?: string;
}

export function registrar(dto: RegistroInput): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/registro', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// --- Productos ---

export function listarProductos(token: string): Promise<Producto[]> {
  return apiFetch<Producto[]>('/productos', { token });
}

export interface CrearProductoInput {
  codigoBarras: string;
  nombre: string;
  precioVentaCentavos: number;
  costoUnitarioCentavos?: number;
  categoria?: string;
  proveedor?: string;
  stockInicial?: number;
  stockMinimo?: number;
}

export function crearProducto(
  token: string,
  dto: CrearProductoInput,
): Promise<Producto> {
  return apiFetch<Producto>('/productos', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export function buscarPorCodigoBarras(
  token: string,
  codigoBarras: string,
): Promise<Producto | null> {
  return apiFetch<Producto | null>(
    `/productos/escanear/${encodeURIComponent(codigoBarras)}`,
    { token },
  );
}

// --- Ventas ---

export interface CrearVentaInput {
  items: { productoId: string; cantidad: number }[];
  montoRecibidoCentavos: number;
}

export function crearVenta(token: string, dto: CrearVentaInput): Promise<Venta> {
  return apiFetch<Venta>('/ventas', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export function obtenerResumenDelDia(token: string): Promise<ResumenDelDia> {
  return apiFetch<ResumenDelDia>('/ventas/resumen-dia', { token });
}
