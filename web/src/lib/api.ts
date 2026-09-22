import type {
  AlertasProductos,
  MotivoMerma,
  Producto,
  ResumenDelDia,
  ResumenMovimientosDelDia,
  TokenPair,
  UsuarioEquipo,
  Venta,
  VentaDelHistorial,
} from './tipos';

// Si NEXT_PUBLIC_API_URL está seteado, gana siempre (útil para producción,
// donde el backend vive en otro host). Si no está seteado, usamos el mismo
// hostname con el que se cargó la página + puerto 3000 — así, sea que
// entres por localhost:3001 o por 192.168.1.XX:3001 desde el celular, la
// API se resuelve sola sin tener que editar .env.local cada vez que el
// router le asigna una IP nueva a la PC (nos pasó 3 veces en un día).
function resolverApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') return `http://${window.location.hostname}:3000`;
  return 'http://localhost:3000'; // fallback para renderizado en el servidor
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

// El accessToken dura 15 min. Cuando vence, el backend responde 401 y
// acá se pide uno nuevo con el refreshToken (lo resuelve auth-context,
// que es quien guarda la sesión) y se repite la petición una vez. Así
// ninguna pantalla tiene que enterarse de que el token se renovó.
type RefrescadorDeSesion = () => Promise<string | null>;
let refrescador: RefrescadorDeSesion | null = null;
let refrescoEnCurso: Promise<string | null> | null = null;

export function configurarRefrescoDeSesion(fn: RefrescadorDeSesion | null) {
  refrescador = fn;
}

// Si varias pantallas reciben 401 a la vez, comparten un solo refresh
// en vez de disparar uno cada una.
function refrescarUnaVez(): Promise<string | null> {
  if (!refrescador) return Promise.resolve(null);
  if (!refrescoEnCurso) {
    refrescoEnCurso = refrescador().finally(() => {
      refrescoEnCurso = null;
    });
  }
  return refrescoEnCurso;
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

  const construirOpciones = (tokenActual?: string): RequestInit => ({
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
      ...headers,
    },
  });

  let fetchOptions = construirOpciones(token);
  let response = await fetch(`${API_URL}${path}`, fetchOptions);

  // Reintentar tras un 401 es seguro incluso en POST: el guard JWT
  // rechaza la petición antes de que el controller haga nada.
  if (response.status === 401 && token) {
    const nuevoToken = await refrescarUnaVez();
    if (nuevoToken) {
      fetchOptions = construirOpciones(nuevoToken);
      response = await fetch(`${API_URL}${path}`, fetchOptions);
    }
  }

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

  // NestJS nunca manda un body realmente vacío en un 200 — aunque el
  // valor sea `null`, igual manda el texto literal "null". Si acá llega
  // vacío es casi siempre un corte de conexión a mitad de la respuesta,
  // no un "sin datos" legítimo.
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

export function loginConClerk(clerkToken: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/clerk', {
    method: 'POST',
    body: JSON.stringify({ clerkToken }),
  });
}

export function refrescarSesion(refreshToken: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
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

// --- Equipo (solo admin) ---

export function listarEquipo(token: string): Promise<UsuarioEquipo[]> {
  return apiFetch<UsuarioEquipo[]>('/usuarios', { token });
}

export interface CrearUsuarioInput {
  nombre: string;
  email: string;
  password: string;
  rol?: 'admin' | 'cajero';
}

export function crearUsuario(
  token: string,
  dto: CrearUsuarioInput,
): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>('/usuarios', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export function desactivarUsuario(token: string, id: string): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>(`/usuarios/${id}/desactivar`, { method: 'PATCH', token });
}

export function reactivarUsuario(token: string, id: string): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>(`/usuarios/${id}/reactivar`, { method: 'PATCH', token });
}

export function cambiarPasswordUsuario(
  token: string,
  id: string,
  password: string,
): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>(`/usuarios/${id}/password`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ password }),
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

// Baja lógica: el producto deja de aparecer en catálogo, escaneo y
// ventas, y su código de barras queda libre. Se puede reactivar.
export function darDeBajaProducto(token: string, id: string): Promise<Producto> {
  return apiFetch<Producto>(`/productos/${id}/baja`, { method: 'PATCH', token });
}

export function reactivarProducto(token: string, id: string): Promise<Producto> {
  return apiFetch<Producto>(`/productos/${id}/reactivar`, {
    method: 'PATCH',
    token,
  });
}

export function listarProductosDadosDeBaja(token: string): Promise<Producto[]> {
  return apiFetch<Producto[]>('/productos/dados-de-baja', { token });
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

export function obtenerVentasDeHoy(token: string): Promise<VentaDelHistorial[]> {
  return apiFetch<VentaDelHistorial[]>('/ventas/hoy', { token });
}

export interface AnularVentaInput {
  motivo: string;
  // Omitido = anular todo lo que quede de la venta.
  items?: { ventaItemId: string; cantidad: number }[];
}

export function anularVenta(
  token: string,
  ventaId: string,
  dto: AnularVentaInput,
): Promise<VentaDelHistorial> {
  return apiFetch<VentaDelHistorial>(`/ventas/${ventaId}/anular`, {
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