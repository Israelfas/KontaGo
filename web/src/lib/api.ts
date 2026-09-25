import type {
  AlertasProductos,
  MetodoPago,
  MotivoMerma,
  PaginaDeMovimientos,
  PaginaDeVentas,
  Producto,
  ResumenDelDia,
  ResumenInventarioPeriodo,
  ResumenMovimientosDelDia,
  ResumenPeriodo,
  Ticket,
  Tienda,
  TipoMovimientoCaja,
  TipoMovimientoInventario,
  TurnoCaja,
  UsuarioEquipo,
  Venta,
  VentaDelHistorial,
} from './tipos';
import type { ActividadDeCuenta } from './actividad';

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

/**
 * No hubo conexión (o no respondió a tiempo): el pedido no llegó al
 * servidor, o no se sabe si llegó. La caja lo usa para seguir vendiendo
 * sin internet.
 */
export class SinConexionError extends Error {
  constructor() {
    super('Sin conexión a internet.');
    this.name = 'SinConexionError';
  }
}

/**
 * El servidor respondió bien pero la respuesta llegó cortada: lo pedido SÍ
 * se hizo, solo que no se sabe el resultado. Una venta con clave se puede
 * mandar de nuevo sin riesgo (el servidor devuelve la misma).
 */
export class RespuestaIncompletaError extends ApiError {}

/** fetch, pero sin red avisa con SinConexionError (y no un TypeError suelto). */
async function pedir(url: string, opciones: RequestInit): Promise<Response> {
  try {
    return await fetch(url, opciones);
  } catch {
    throw new SinConexionError();
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

interface OpcionesDePedido extends RequestInit {
  token?: string;
  /**
   * Pedido de sesión (entrar, renovar, salir): la renovación viaja en una
   * cookie httpOnly que ningún script puede leer. El backend la usa solo si
   * el pedido dice X-Cliente: web.
   */
  conCookie?: boolean;
}

/**
 * El pedido con el token y la base URL. Si el token venció (401), renueva
 * la sesión y reintenta una vez. Lo usan apiFetch (JSON) y las descargas.
 */
async function pedirConSesion(
  path: string,
  options: OpcionesDePedido = {},
): Promise<{ response: Response; fetchOptions: RequestInit }> {
  const { token, headers, conCookie, ...resto } = options;

  const construirOpciones = (tokenActual?: string): RequestInit => ({
    ...resto,
    // La cookie de la sesión solo viaja en los pedidos de sesión.
    ...(conCookie ? { credentials: 'include' as const } : {}),
    headers: {
      'Content-Type': 'application/json',
      ...(conCookie ? { 'X-Cliente': 'web' } : {}),
      ...(tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
      ...headers,
    },
  });

  let fetchOptions = construirOpciones(token);
  let response = await pedir(`${API_URL}${path}`, fetchOptions);

  // Reintentar tras un 401 es seguro incluso en POST: el guard JWT
  // rechaza la petición antes de que el controller haga nada.
  if (response.status === 401 && token) {
    const nuevoToken = await refrescarUnaVez();
    if (nuevoToken) {
      fetchOptions = construirOpciones(nuevoToken);
      response = await pedir(`${API_URL}${path}`, fetchOptions);
    }
  }
  return { response, fetchOptions };
}

/** El backend siempre devuelve { message, error, statusCode } en errores. */
async function errorDeLaRespuesta(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const mensaje = Array.isArray(body?.message)
    ? body.message.join(' ') // errores de validación: oraciones en español
    : (body?.message ?? `Error ${response.status}`);
  return new ApiError(mensaje, response.status);
}

/**
 * Wrapper central de fetch. Todas las llamadas al backend pasan por acá,
 * así el manejo de errores, el header de auth y la base URL están en un
 * solo lugar.
 */
async function apiFetch<T>(path: string, options: OpcionesDePedido = {}): Promise<T> {
  const { response, fetchOptions } = await pedirConSesion(path, options);

  if (!response.ok) throw await errorDeLaRespuesta(response);

  // Algunos endpoints (204) no devuelven body.
  if (response.status === 204) {
    return undefined as T;
  }

  // Ningún endpoint de KontaGo responde 200 con cuerpo vacío: cuando no
  // hay dato se usa 404 (ojo: si un handler de Nest devuelve null, Nest
  // manda 200 con el cuerpo VACÍO, no el texto "null" — por eso el
  // escaneo responde 404). Así que si acá llega vacío es casi siempre un
  // corte de conexión a mitad de la respuesta, no un "sin datos".
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
    throw new RespuestaIncompletaError(
      'Es posible que esto sí se haya guardado, pero no pudimos confirmarlo por un corte de conexión. Revisa la lista antes de intentar de nuevo.',
      response.status,
    );
  }

  // Para GET (leer datos) reintentar es seguro: no hay efecto secundario
  // que duplicar. Si el segundo intento también llega vacío, ahí sí lo
  // tratamos como falla real en vez de inventar un resultado.
  const reintento = await pedir(`${API_URL}${path}`, fetchOptions);
  if (!reintento.ok) {
    throw new ApiError(`Error ${reintento.status}`, reintento.status);
  }
  const textoReintento = await reintento.text();
  if (!textoReintento) {
    throw new ApiError(
      'El servidor no respondió (conexión inestable). Prueba de nuevo.',
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

/**
 * La cuenta tiene la verificación en dos pasos: la contraseña (o Google)
 * estuvo bien, falta el código. El desafío dura unos minutos.
 */
export interface DesafioDosPasos {
  requiereCodigo: true;
  desafio: string;
}

/**
 * Lo que recibe la web al entrar: solo el token de acceso (dura minutos y
 * vive en memoria). El de renovación queda en una cookie httpOnly.
 */
export interface SesionWeb {
  accessToken: string;
}

export type RespuestaIngreso = SesionWeb | DesafioDosPasos;

export const pideCodigo = (r: RespuestaIngreso): r is DesafioDosPasos => 'requiereCodigo' in r;

export function login(email: string, password: string): Promise<RespuestaIngreso> {
  return apiFetch<RespuestaIngreso>('/auth/login', {
    method: 'POST',
    conCookie: true,
    body: JSON.stringify({ email, password }),
  });
}

export function loginConClerk(clerkToken: string): Promise<RespuestaIngreso> {
  return apiFetch<RespuestaIngreso>('/auth/clerk', {
    method: 'POST',
    conCookie: true,
    body: JSON.stringify({ clerkToken }),
  });
}

/**
 * Renueva el token de acceso con la cookie. `tokenViejo`: el que quedaba en
 * el navegador de antes de la cookie; se canjea una vez y pasa a la cookie.
 */
export function refrescarSesion(tokenViejo?: string): Promise<SesionWeb> {
  return apiFetch<SesionWeb>('/auth/refresh', {
    method: 'POST',
    conCookie: true,
    body: JSON.stringify(tokenViejo ? { refreshToken: tokenViejo } : {}),
  });
}

// Cierra la sesión en el servidor: el refreshToken y el accessToken dejan
// de servir (si alguien los copió, tampoco le sirven). Nunca falla del
// lado del backend (204), pero sin conexión sí: el que llama lo ignora.
export function cerrarSesionEnServidor(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST', conCookie: true, body: '{}' });
}

export interface RegistroInput {
  nombreTienda: string;
  nombreAdmin: string;
  email: string;
  password: string;
  aceptaTerminos: boolean;
  moneda?: string;
}

export function registrar(dto: RegistroInput): Promise<SesionWeb> {
  return apiFetch<SesionWeb>('/auth/registro', {
    method: 'POST',
    conCookie: true,
    body: JSON.stringify(dto),
  });
}

// --- Recuperar la contraseña ---

/** Manda el enlace por email. Responde igual exista o no la cuenta. */
export function pedirRecuperacion(email: string): Promise<void> {
  return apiFetch<void>('/auth/olvide-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Falla (400) si el enlace venció o ya se usó. */
export function verificarRecuperacion(token: string): Promise<void> {
  return apiFetch<void>('/auth/restablecer-password/verificar', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function restablecerPassword(token: string, password: string): Promise<void> {
  return apiFetch<void>('/auth/restablecer-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

// Datos de la cuenta que no viajan en el token: nombre, email, tienda y plan.
export interface Perfil {
  nombre: string;
  email: string;
  rol: 'admin' | 'cajero';
  tienda: string | null;
  plan: 'gratuito' | 'pago' | 'enterprise' | null;
  dosPasos: boolean;
}

export function obtenerPerfil(token: string): Promise<Perfil> {
  return apiFetch<Perfil>('/auth/perfil', { token });
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

export function crearUsuario(token: string, dto: CrearUsuarioInput): Promise<UsuarioEquipo> {
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

export function crearProducto(token: string, dto: CrearProductoInput): Promise<Producto> {
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

// null = el código no está en el catálogo (el backend responde 404), para
// que la caja ofrezca darlo de alta en vez de mostrar un error.
// Con red lenta no se queda esperando: pasado el límite avisa
// SinConexionError y la caja busca en el catálogo guardado.
export async function buscarPorCodigoBarras(
  token: string,
  codigoBarras: string,
  limiteMs = 5_000,
): Promise<Producto | null> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), limiteMs);
  try {
    return await apiFetch<Producto>(`/productos/escanear/${encodeURIComponent(codigoBarras)}`, {
      token,
      signal: control.signal,
    });
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  } finally {
    clearTimeout(reloj);
  }
}

// --- Ventas ---

export interface CrearVentaInput {
  items: { productoId: string; cantidad: number }[];
  metodoPago: MetodoPago;
  // Solo en efectivo (en transferencia se paga el total exacto).
  montoRecibidoCentavos?: number;
  // La genera el navegador: si la venta llega dos veces, se cobra una.
  claveIdempotencia?: string;
  // Cuándo se cobró, si se manda después (se hizo sin conexión).
  vendidaEn?: string;
}

/**
 * Registra una venta. Con red lenta no espera para siempre: pasado el
 * límite avisa SinConexionError y la caja la guarda para mandarla
 * después (con la clave, si al final sí llegó, no se duplica).
 */
export function crearVenta(token: string, dto: CrearVentaInput, limiteMs = 12_000): Promise<Venta> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), limiteMs);
  return apiFetch<Venta>('/ventas', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
    signal: control.signal,
  }).finally(() => clearTimeout(reloj));
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

export interface RangoDeFechas {
  desde: string; // AAAA-MM-DD, incluido
  hasta: string; // AAAA-MM-DD, incluido
}

// Resumen de un período (hasta 92 días). Solo admin.
export function obtenerResumen(token: string, rango: RangoDeFechas): Promise<ResumenPeriodo> {
  const q = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  return apiFetch<ResumenPeriodo>(`/ventas/resumen?${q}`, { token });
}

// Ventas de un período, de la más reciente a la más vieja, de a `limite`.
export function listarVentas(
  token: string,
  rango: RangoDeFechas,
  limite = 50,
  desplazamiento = 0,
): Promise<PaginaDeVentas> {
  const q = new URLSearchParams({
    desde: rango.desde,
    hasta: rango.hasta,
    limite: String(limite),
    desplazamiento: String(desplazamiento),
  });
  return apiFetch<PaginaDeVentas>(`/ventas?${q}`, { token });
}

// Un ticket por su número, de cualquier fecha. Solo admin.
export function buscarVentaPorNumero(token: string, numero: number): Promise<PaginaDeVentas> {
  return apiFetch<PaginaDeVentas>(`/ventas?numero=${numero}`, { token });
}

// --- Inventario ---

export interface RegistrarAbastecimientoInput {
  productoId: string;
  cantidad: number;
  costoUnitarioCentavos: number;
  proveedor?: string;
  // Vencimiento de esta mercadería: entra como un lote aparte.
  fechaVencimiento?: string;
}

export function registrarAbastecimiento(token: string, dto: RegistrarAbastecimientoInput) {
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
  // Omitido: sale del lote que vence antes.
  loteId?: string;
}

export interface FilaDeLote {
  id?: string; // sin id: lote nuevo
  fechaVencimiento: string | null;
  cantidad: number;
}

// Reparto del stock entre fechas (después de revisar la góndola). Tiene
// que sumar el stock actual. Solo admin.
export function corregirLotes(
  token: string,
  productoId: string,
  lotes: FilaDeLote[],
): Promise<Producto> {
  return apiFetch<Producto>(`/inventario/productos/${productoId}/lotes`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ lotes }),
  });
}

export function registrarMerma(token: string, dto: RegistrarMermaInput) {
  return apiFetch('/inventario/merma', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export function obtenerResumenInventarioDelDia(token: string): Promise<ResumenMovimientosDelDia> {
  return apiFetch<ResumenMovimientosDelDia>('/inventario/resumen-dia', {
    token,
  });
}

export function obtenerAlertas(token: string, diasVencimiento?: number): Promise<AlertasProductos> {
  const query = diasVencimiento ? `?diasVencimiento=${diasVencimiento}` : '';
  return apiFetch<AlertasProductos>(`/productos/alertas${query}`, { token });
}

// --- Caja ---

// Mi caja abierta, o null si no tengo.
export async function obtenerCajaActual(token: string): Promise<TurnoCaja | null> {
  return (await apiFetch<{ turno: TurnoCaja | null }>('/caja/actual', { token })).turno;
}

export function abrirCaja(token: string, fondoInicialCentavos: number): Promise<TurnoCaja> {
  return apiFetch<TurnoCaja>('/caja/abrir', {
    method: 'POST',
    token,
    body: JSON.stringify({ fondoInicialCentavos }),
  });
}

export interface MovimientoCajaInput {
  tipo: TipoMovimientoCaja;
  montoCentavos: number;
  motivo: string;
}

export function registrarMovimientoCaja(
  token: string,
  dto: MovimientoCajaInput,
): Promise<TurnoCaja> {
  return apiFetch<TurnoCaja>('/caja/movimientos', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

export interface CerrarCajaInput {
  efectivoContadoCentavos: number;
  nota?: string;
}

// Cierra mi caja (o, con turnoId, la de otro: solo admin).
export function cerrarCaja(
  token: string,
  dto: CerrarCajaInput,
  turnoId?: string,
): Promise<TurnoCaja> {
  return apiFetch<TurnoCaja>(turnoId ? `/caja/turnos/${turnoId}/cerrar` : '/caja/cerrar', {
    method: 'POST',
    token,
    body: JSON.stringify(dto),
  });
}

// Turnos de todo el equipo abiertos en el período, más los que siguen
// abiertos. Solo admin.
export function listarTurnosCaja(token: string, rango: RangoDeFechas): Promise<TurnoCaja[]> {
  return apiFetch<TurnoCaja[]>(
    `/caja/turnos?desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`,
    { token },
  );
}

// El ticket de una venta (el cajero, solo de ventas de hoy).
export function obtenerTicket(token: string, ventaId: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/ventas/${ventaId}/ticket`, { token });
}

// --- Datos de la tienda (solo admin) ---

export function obtenerTienda(token: string): Promise<Tienda> {
  return apiFetch<Tienda>('/tienda', { token });
}

// Solo cambia lo que se manda; un texto vacío borra ese dato.
export function actualizarTienda(token: string, datos: Partial<Tienda>): Promise<Tienda> {
  return apiFetch<Tienda>('/tienda', {
    method: 'PATCH',
    token,
    body: JSON.stringify(datos),
  });
}

// --- Historial de inventario (solo admin) ---

// Query string a mano (en React Native, URLSearchParams está incompleto).
function consulta(valores: Record<string, string | number | undefined>): string {
  return Object.entries(valores)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function listarMovimientosInventario(
  token: string,
  rango: RangoDeFechas,
  filtros: {
    tipo?: TipoMovimientoInventario;
    productoId?: string;
    limite?: number;
    desplazamiento?: number;
  } = {},
): Promise<PaginaDeMovimientos> {
  const q = consulta({ desde: rango.desde, hasta: rango.hasta, ...filtros });
  return apiFetch<PaginaDeMovimientos>(`/inventario/movimientos?${q}`, { token });
}

export function obtenerResumenInventario(
  token: string,
  rango: RangoDeFechas,
): Promise<ResumenInventarioPeriodo> {
  const q = consulta({ desde: rango.desde, hasta: rango.hasta });
  return apiFetch<ResumenInventarioPeriodo>(`/inventario/resumen?${q}`, { token });
}

// --- Verificación en dos pasos ---

/** Segundo paso del ingreso: el código de la app o uno de recuperación. */
export function ingresarConCodigo(desafio: string, codigo: string): Promise<SesionWeb> {
  return apiFetch<SesionWeb>('/auth/login/codigo', {
    method: 'POST',
    conCookie: true,
    body: JSON.stringify({ desafio, codigo }),
  });
}

export interface EstadoDosPasos {
  activa: boolean;
  desde: string | null;
  codigosRestantes: number;
}

export function obtenerDosPasos(token: string): Promise<EstadoDosPasos> {
  return apiFetch<EstadoDosPasos>('/auth/dos-pasos', { token });
}

/** Un secreto nuevo para cargar en la app autenticadora (queda pendiente). */
export function iniciarDosPasos(token: string): Promise<{ secreto: string; enlace: string }> {
  return apiFetch('/auth/dos-pasos/iniciar', { method: 'POST', token });
}

/** Con un código de la app queda activada; los de recuperación se ven una sola vez. */
export function activarDosPasos(
  token: string,
  codigo: string,
): Promise<{ codigosRecuperacion: string[] }> {
  return apiFetch('/auth/dos-pasos/activar', {
    method: 'POST',
    token,
    body: JSON.stringify({ codigo }),
  });
}

export function desactivarDosPasos(token: string, codigo: string): Promise<void> {
  return apiFetch<void>('/auth/dos-pasos/desactivar', {
    method: 'POST',
    token,
    body: JSON.stringify({ codigo }),
  });
}

/** El admin se la quita a alguien del equipo que perdió el celular. */
export function quitarDosPasos(token: string, id: string): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>(`/usuarios/${id}/dos-pasos/quitar`, { method: 'PATCH', token });
}

// --- Reporte en Excel (solo admin) ---

/**
 * El reporte del período para el contador: ventas, productos vendidos,
 * caja, compras y mermas, y el stock actual. El nombre del archivo lo arma
 * el backend (lleva el nombre de la tienda).
 */
export async function descargarReporteExcel(
  token: string,
  rango: RangoDeFechas,
): Promise<{ archivo: Blob; nombre: string }> {
  const q = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  const { response } = await pedirConSesion(`/reportes/excel?${q}`, { token });
  if (!response.ok) throw await errorDeLaRespuesta(response);
  const nombre =
    /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ??
    `kontago-${rango.desde}-a-${rango.hasta}.xlsx`;
  return { archivo: await response.blob(), nombre };
}

// --- Actividad de seguridad (solo admin, salvo cerrar las propias) ---

export function obtenerActividad(token: string, id: string): Promise<ActividadDeCuenta> {
  return apiFetch<ActividadDeCuenta>(`/usuarios/${id}/actividad`, { token });
}

/** Cierra la sesión de alguien del equipo en todos sus dispositivos. */
export function cerrarSesionesDe(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/usuarios/${id}/cerrar-sesiones`, { method: 'POST', token });
}

export function desbloquearUsuario(token: string, id: string): Promise<UsuarioEquipo> {
  return apiFetch<UsuarioEquipo>(`/usuarios/${id}/desbloquear`, { method: 'PATCH', token });
}

/** Cierra la sesión propia en todos los dispositivos (también este). */
export function cerrarMisSesiones(token: string): Promise<void> {
  // Con la cookie: el backend también la borra.
  return apiFetch<void>('/auth/cerrar-sesiones', { method: 'POST', token, conCookie: true });
}
