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

// El celular no puede usar "localhost" — eso apuntaría al propio
// celular, no a la PC. Antes esto se configuraba a mano en
// app.json > expo.extra.apiUrl, pero la IP de LAN de la PC cambia cada
// vez que el router renueva el DHCP o cambiás de red — cada cambio
// rompía la app hasta actualizar el archivo a mano.
//
// Fix: Expo ya sabe con qué IP:puerto se conectó el celular a Metro
// para bajar el código (Constants.expoConfig.hostUri, algo como
// "192.168.1.18:8081") — reusamos esa misma IP para hablar con el
// backend, así la detección es automática y sigue funcionando aunque
// la IP cambie, sin tocar ningún archivo. app.json > extra.apiUrl queda
// como respaldo manual para casos donde hostUri no está disponible
// (ej. un build standalone con EAS, que no pasa por Metro).
function resolverApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:3000`;
  }
  const configurado = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return configurado ?? 'http://localhost:3000';
}

const API_URL = resolverApiUrl();

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
  // legítimo.
  const texto = await response.text();
  if (texto) {
    return parsearOFallar<T>(texto, response.status);
  }

  const metodo = (fetchOptions.method ?? 'GET').toUpperCase();
  if (metodo !== 'GET') {
    // OJO: acá NO hay que reintentar. Si esta petición ya modificó algo
    // (crear producto, registrar venta, etc.) y el servidor respondió
    // 2xx pero el body llegó cortado, el request YA se procesó del lado
    // del backend. Reintentar mandaría la misma petición de nuevo — en
    // el mejor caso, un duplicado; con la restricción de código de
    // barras único, un 409 confuso sobre algo que en realidad sí
    // funcionó la primera vez. Mejor avisar y dejar que la persona
    // confirme mirando la lista, que resubmitir a ciegas.
    throw new ApiError(
      'Es posible que esto sí se haya guardado, pero no pudimos confirmarlo por un corte de conexión. Revisá la lista antes de intentar de nuevo.',
      response.status,
    );
  }

  // Para GET (leer datos) reintentar es seguro: no hay efecto secundario
  // que duplicar. Si el segundo intento también llega vacío, ahí sí lo
  // tratamos como falla real en vez de inventar un resultado.
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

export interface Perfil {
  nombre: string;
  email: string;
  rol: 'admin' | 'cajero';
  tienda: string | null;
  plan: 'gratuito' | 'pago' | 'enterprise' | null;
}

export function obtenerPerfil(token: string): Promise<Perfil> {
  return apiFetch<Perfil>('/auth/perfil', { token });
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