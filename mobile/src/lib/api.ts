import Constants from 'expo-constants';
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
  TokenPair,
  TurnoCaja,
  UsuarioEquipo,
  Venta,
  VentaDelHistorial,
} from './tipos';
import type { ActividadDeCuenta } from './actividad';
import { Directory, File, Paths } from 'expo-file-system';

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
  // En producción (build con EAS) la dirección del backend se fija con
  // EXPO_PUBLIC_API_URL. Vacía en desarrollo: se detecta sola (abajo).
  const deProduccion = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (deProduccion) return deProduccion.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:3000`;
  }
  const configurado = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return configurado ?? 'http://localhost:3000';
}

const API_URL = resolverApiUrl();

/**
 * La web (términos, privacidad, y adonde lleva el enlace de recuperar la
 * contraseña). EXPO_PUBLIC_WEB_URL en producción; en desarrollo, la misma
 * PC que sirve el backend, en el puerto de la web.
 */
export const WEB_URL = (() => {
  const configurada = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, '');
  return API_URL.replace(/:3000$/, ':3001');
})();

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

  const construirOpciones = (tokenActual?: string): RequestInit => ({
    ...resto,
    headers: {
      'Content-Type': 'application/json',
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

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const mensaje = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? `Error ${response.status}`);
    throw new ApiError(mensaje, response.status);
  }

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
  aceptaTerminos: boolean;
  moneda?: string;
}

/** "Olvidé mi contraseña": manda el enlace por email (responde igual exista o no). */
export function pedirRecuperacion(email: string): Promise<void> {
  return apiFetch<void>('/auth/olvide-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function registrar(dto: RegistroInput): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/registro', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// Puente con Clerk: manda el token de sesión de Clerk y recibe el JWT
// propio de KontaGo.
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

// Cierra la sesión en el servidor: el refreshToken y el accessToken dejan
// de servir (si alguien los copió, tampoco le sirven). Nunca falla del
// lado del backend (204), pero sin conexión sí: el que llama lo ignora.
export function cerrarSesionEnServidor(refreshToken: string): Promise<void> {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
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
    return await apiFetch<Producto>(
      `/productos/escanear/${encodeURIComponent(codigoBarras)}`,
      { token, signal: control.signal },
    );
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
  // La genera el celular: si la venta llega dos veces, se cobra una.
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

// Query string a mano: el URLSearchParams de React Native está incompleto.
function query(valores: Record<string, string | number>): string {
  return Object.entries(valores)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

// --- Reporte en Excel (solo admin) ---

const TIPO_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** downloadFileAsync solo trae el código HTTP en el mensaje: se traduce acá. */
function errorDeDescarga(err: unknown): ApiError {
  const codigo = Number(/\b([45]\d\d)\b/.exec(String(err))?.[1] ?? 0);
  if (codigo === 400) return new ApiError('Se pueden bajar hasta 92 días de una vez.', 400);
  if (codigo === 403) return new ApiError('Solo el administrador puede bajar el reporte.', 403);
  return new ApiError('No se pudo preparar el Excel. Revisa tu conexión y prueba de nuevo.', codigo);
}

/**
 * Baja el reporte del período (ventas, productos vendidos, caja, compras y
 * mermas, stock) a la caché del celular y devuelve el archivo, listo para
 * compartir. Lo descarga el sistema, sin pasar el binario por JavaScript,
 * y el nombre lo pone el backend. Si el token venció, renueva y reintenta.
 */
export async function descargarReporteExcel(token: string, rango: RangoDeFechas): Promise<File> {
  const url = `${API_URL}/reportes/excel?${query({ desde: rango.desde, hasta: rango.hasta })}`;
  const bajar = (tokenActual: string) =>
    File.downloadFileAsync(url, new Directory(Paths.cache), {
      headers: { Authorization: `Bearer ${tokenActual}`, Accept: TIPO_EXCEL },
      // Si ya se bajó el mismo período, se reemplaza.
      idempotent: true,
    });
  try {
    return await bajar(token);
  } catch (err) {
    if (!/\b401\b/.test(String(err))) throw errorDeDescarga(err);
    const nuevoToken = await refrescarUnaVez();
    if (!nuevoToken) throw new ApiError('Tu sesión venció. Vuelve a entrar.', 401);
    try {
      return await bajar(nuevoToken);
    } catch (reintento) {
      throw errorDeDescarga(reintento);
    }
  }
}

// Resumen de un período (hasta 92 días). Solo admin.
export function obtenerResumen(token: string, rango: RangoDeFechas): Promise<ResumenPeriodo> {
  return apiFetch<ResumenPeriodo>(`/ventas/resumen?${query({ desde: rango.desde, hasta: rango.hasta })}`, {
    token,
  });
}

// Ventas de un período, de la más reciente a la más vieja, de a `limite`.
export function listarVentas(
  token: string,
  rango: RangoDeFechas,
  limite = 50,
  desplazamiento = 0,
): Promise<PaginaDeVentas> {
  const q = query({ desde: rango.desde, hasta: rango.hasta, limite, desplazamiento });
  return apiFetch<PaginaDeVentas>(`/ventas?${q}`, { token });
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
  return apiFetch<void>('/auth/cerrar-sesiones', { method: 'POST', token });
}

