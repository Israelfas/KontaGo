import Constants from 'expo-constants';
import type {
  AlertasProductos,
  MotivoMerma,
  Producto,
  ResumenDelDia,
  ResumenMovimientosDelDia,
  TokenPair,
  Venta,
} from './tipos';

// A diferencia del web (que corre en el mismo host que el backend en dev),
// un celular físico necesita la IP de LAN de la PC, no "localhost" — eso
// apuntaría al propio celular. Se configura en app.json > expo.extra.apiUrl
// (ver README de mobile/ para instrucciones).
const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000';

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
 * solo lugar. Idéntico en espíritu al de web/src/lib/api.ts.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...resto } = options;

  const fetchOptions: RequestInit = {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  const response = await fetch(`${API_URL}${path}`, fetchOptions);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const mensaje = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `Error ${response.status}`);
    throw new ApiError(mensaje, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // NestJS nunca manda un body realmente vacío para una respuesta 200 —
  // aunque el valor sea `null`, igual manda el texto literal "null" (4
  // bytes). Así que si acá llega texto vacío, es casi siempre un corte
  // de la conexión WiFi a mitad de la respuesta, NO un "sin datos"
  // legítimo. Tratarlo como éxito silencioso fue el bug real: un
  // producto que SÍ existe podía llegar con el body cortado y mostrarse
  // como "no encontrado". En vez de eso, reintentamos una vez — si el
  // segundo intento también llega vacío, ahí sí lo tratamos como falla
  // real en vez de inventar un resultado.
  const texto = await response.text();
  if (texto) {
    return parsearOFallar<T>(texto, response.status);
  }

  const reintento = await fetch(`${API_URL}${path}`, fetchOptions);
  if (!reintento.ok) {
    throw new ApiError(`Error ${reintento.status}`, reintento.status);
  }
  const textoReintento = await reintento.text();
  if (!textoReintento) {
    throw new ApiError(
      'El servidor no respondió (conexión inestable). Probá de nuevo.',
      response.status,
    );
  }
  return parsearOFallar<T>(textoReintento, reintento.status);
}

function parsearOFallar<T>(texto: string, statusCode: number): T {
  try {
    return JSON.parse(texto);
  } catch {
    throw new ApiError('Respuesta inválida del servidor', statusCode);
  }
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
  fechaVencimiento?: string;
  ivaExento?: boolean;
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

export interface ActualizarProductoInput {
  nombre?: string;
  categoria?: string;
  proveedor?: string;
  precioVentaCentavos?: number;
  costoUnitarioCentavos?: number;
  stockMinimo?: number;
  fechaVencimiento?: string;
  quitarFechaVencimiento?: boolean;
  ivaExento?: boolean;
}

export function actualizarProducto(
  token: string,
  id: string,
  dto: ActualizarProductoInput,
): Promise<Producto> {
  return apiFetch<Producto>(`/productos/${id}`, {
    method: 'PATCH',
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

// --- Inventario ---

export interface RegistrarAbastecimientoInput {
  productoId: string;
  cantidad: number;
  costoUnitarioCentavos: number;
  proveedor?: string;
}

export function registrarAbastecimiento(
  token: string,
  dto: RegistrarAbastecimientoInput,
) {
  return apiFetch('/inventario/abastecimiento', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export interface RegistrarMermaInput {
  productoId: string;
  cantidad: number;
  motivo: MotivoMerma;
}

export function registrarMerma(token: string, dto: RegistrarMermaInput) {
  return apiFetch('/inventario/merma', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export function obtenerResumenInventarioDelDia(
  token: string,
): Promise<ResumenMovimientosDelDia> {
  return apiFetch<ResumenMovimientosDelDia>('/inventario/resumen-dia', {
    token,
  });
}

export function obtenerAlertas(
  token: string,
  diasVencimiento?: number,
): Promise<AlertasProductos> {
  const query = diasVencimiento ? `?diasVencimiento=${diasVencimiento}` : '';
  return apiFetch<AlertasProductos>(`/productos/alertas${query}`, { token });
}