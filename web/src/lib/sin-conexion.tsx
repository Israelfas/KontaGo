'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth-context';
import {
  ApiError,
  RespuestaIncompletaError,
  SinConexionError,
  crearVenta,
  listarProductos,
} from './api';
import type { MetodoPago, Producto, TurnoCaja } from './tipos';
import { redondear } from './cantidad';

/*
 * Vender sin internet.
 *
 * Si se corta la conexión con la caja abierta, se sigue vendiendo: los
 * productos se buscan en el catálogo guardado en el navegador y cada venta
 * queda en una cola (sobrevive a cerrar la pestaña). Cuando vuelve
 * internet, las ventas se mandan solas, en orden, con la hora en que se
 * cobraron.
 *
 * Cada venta lleva una clave que genera el navegador: si el servidor ya la
 * tenía (se cortó justo cuando respondía), devuelve la misma y no cobra dos
 * veces. Si al mandarla el servidor la rechaza (no queda stock, la caja se
 * cerró desde otro lado), queda marcada "con problema" para que alguien
 * decida: reintentar o descartar. Nunca se pierde en silencio.
 *
 * Todo se guarda por usuario: si otra persona entra en el mismo navegador,
 * no manda ventas a nombre de la anterior. Y varias pestañas comparten la
 * misma cola (cada cambio se relee antes de escribir).
 */

export interface LineaPendiente {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioVentaCentavos: number;
}

export interface VentaPendiente {
  clave: string;
  vendidaEn: string;
  items: LineaPendiente[];
  metodoPago: MetodoPago;
  montoRecibidoCentavos?: number;
  // Al fiado: a quién.
  clienteId?: string;
  clienteNombre?: string;
  totalCentavos: number;
  // El servidor la rechazó: por qué. Mientras tanto no se reintenta sola.
  problema?: string;
}

interface CatalogoGuardado {
  guardadoEn: string;
  productos: Producto[];
}

interface ValorSinConexion {
  /** El último intento de hablar con el servidor falló por falta de red. */
  sinConexion: boolean;
  pendientes: VentaPendiente[];
  enviando: boolean;
  catalogo: CatalogoGuardado | null;
  /** La caja tal como se vio la última vez que hubo conexión. */
  ultimaCaja: TurnoCaja | null | undefined;
  marcarSinConexion: (valor: boolean) => void;
  recordarCaja: (turno: TurnoCaja | null) => void;
  /** Baja el catálogo y lo guarda (descontando lo que falta mandar). */
  actualizarCatalogo: () => Promise<void>;
  /** Busca en el catálogo guardado. */
  buscarEnCatalogo: (codigoBarras: string) => Producto | null;
  /** Descuenta del stock guardado lo que se acaba de vender. */
  descontarDelCatalogo: (items: { productoId: string; cantidad: number }[]) => void;
  guardarVenta: (venta: Omit<VentaPendiente, 'problema'>) => void;
  enviarPendientes: () => Promise<void>;
  reintentar: (clave: string) => void;
  descartar: (clave: string) => void;
}

const Contexto = createContext<ValorSinConexion | null>(null);

/** Cada cuánto se reintenta mandar la cola mientras haya algo. */
const CADA_MS = 20_000;

/** Clave única de una venta (UUID v4). */
export function nuevaClave(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Es un corte de conexión (y no un "no" del servidor). */
export function esFaltaDeConexion(err: unknown): boolean {
  return err instanceof SinConexionError || err instanceof RespuestaIncompletaError;
}

// --- Almacenamiento del navegador ---

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? (JSON.parse(texto) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, dato: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(dato));
  } catch {
    // Sin espacio o sin permiso: se sigue con lo que hay en memoria.
  }
}

export function SinConexionProvider({ children }: { children: ReactNode }) {
  const { token, usuario } = useAuth();
  const cuenta = usuario?.sub ?? null;
  const claves = useMemo(
    () =>
      cuenta
        ? {
            pendientes: `kontago-pendientes-${cuenta}`,
            catalogo: `kontago-catalogo-${cuenta}`,
            caja: `kontago-caja-${cuenta}`,
          }
        : null,
    [cuenta],
  );

  const [sinConexion, setSinConexion] = useState(false);
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoGuardado | null>(null);
  const [ultimaCaja, setUltimaCaja] = useState<TurnoCaja | null | undefined>(undefined);

  // Lo más nuevo, para las funciones que corren fuera del render.
  const pendientesRef = useRef<VentaPendiente[]>([]);
  const catalogoRef = useRef<CatalogoGuardado | null>(null);
  const enviandoRef = useRef(false);

  /**
   * Cambia la cola partiendo de lo guardado (otra pestaña pudo agregar una
   * venta recién): así ninguna pisa lo que cobró la otra.
   */
  const modificarPendientes = useCallback(
    (cambio: (actuales: VentaPendiente[]) => VentaPendiente[]) => {
      const actuales = claves
        ? leer<VentaPendiente[]>(claves.pendientes, pendientesRef.current)
        : pendientesRef.current;
      const nuevas = cambio(actuales);
      pendientesRef.current = nuevas;
      setPendientes(nuevas);
      if (claves) escribir(claves.pendientes, nuevas);
    },
    [claves],
  );

  const cambiarCatalogo = useCallback(
    (nuevo: CatalogoGuardado | null) => {
      catalogoRef.current = nuevo;
      setCatalogo(nuevo);
      if (claves && nuevo) escribir(claves.catalogo, nuevo);
    },
    [claves],
  );

  // Al entrar (o cambiar de cuenta), lo guardado de esa cuenta. El
  // almacenamiento del navegador solo existe acá, en un efecto.
  useEffect(() => {
    const cola = claves ? leer<VentaPendiente[]>(claves.pendientes, []) : [];
    const guardado = claves ? leer<CatalogoGuardado | null>(claves.catalogo, null) : null;
    const caja = claves ? leer<{ turno: TurnoCaja | null } | null>(claves.caja, null) : null;
    pendientesRef.current = cola;
    catalogoRef.current = guardado;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPendientes(cola);
    setCatalogo(guardado);
    setUltimaCaja(caja ? caja.turno : undefined);
    setSinConexion(typeof navigator !== 'undefined' && navigator.onLine === false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [claves]);

  // Otra pestaña cambió la cola o el catálogo: se ve acá también.
  useEffect(() => {
    if (!claves) return;
    const alCambiar = (e: StorageEvent) => {
      if (e.key === claves.pendientes) {
        const cola = leer<VentaPendiente[]>(claves.pendientes, []);
        pendientesRef.current = cola;
        setPendientes(cola);
      } else if (e.key === claves.catalogo) {
        const guardado = leer<CatalogoGuardado | null>(claves.catalogo, null);
        catalogoRef.current = guardado;
        setCatalogo(guardado);
      }
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [claves]);

  const recordarCaja = useCallback(
    (turno: TurnoCaja | null) => {
      setUltimaCaja(turno);
      if (claves) escribir(claves.caja, { turno });
    },
    [claves],
  );

  /** Unidades que todavía no llegaron al servidor, por producto. */
  const porMandar = useCallback(() => {
    const cuenta = new Map<string, number>();
    for (const venta of pendientesRef.current) {
      if (venta.problema) continue;
      for (const linea of venta.items) {
        cuenta.set(
          linea.productoId,
          redondear((cuenta.get(linea.productoId) ?? 0) + linea.cantidad),
        );
      }
    }
    return cuenta;
  }, []);

  const actualizarCatalogo = useCallback(async () => {
    if (!token) return;
    try {
      const productos = await listarProductos(token);
      // El stock del servidor todavía no descuenta lo que falta mandar.
      const faltan = porMandar();
      cambiarCatalogo({
        guardadoEn: new Date().toISOString(),
        productos: productos.map((p) => ({
          ...p,
          stock: Math.max(0, redondear(p.stock - (faltan.get(p.id) ?? 0))),
        })),
      });
      setSinConexion(false);
    } catch (err) {
      if (esFaltaDeConexion(err)) setSinConexion(true);
    }
  }, [token, porMandar, cambiarCatalogo]);

  const buscarEnCatalogo = useCallback((codigoBarras: string) => {
    return (
      catalogoRef.current?.productos.find((p) => p.codigoBarras === codigoBarras.trim()) ?? null
    );
  }, []);

  const descontarDelCatalogo = useCallback(
    (items: { productoId: string; cantidad: number }[]) => {
      const actual = catalogoRef.current;
      if (!actual) return;
      const vendidas = new Map(items.map((i) => [i.productoId, i.cantidad]));
      cambiarCatalogo({
        ...actual,
        productos: actual.productos.map((p) =>
          vendidas.has(p.id)
            ? { ...p, stock: Math.max(0, redondear(p.stock - vendidas.get(p.id)!)) }
            : p,
        ),
      });
    },
    [cambiarCatalogo],
  );

  const enviarPendientes = useCallback(async () => {
    if (!token || enviandoRef.current) return;
    if (!pendientesRef.current.some((v) => !v.problema)) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      for (const venta of pendientesRef.current.filter((v) => !v.problema)) {
        try {
          await crearVenta(token, {
            items: venta.items.map(({ productoId, cantidad }) => ({ productoId, cantidad })),
            metodoPago: venta.metodoPago,
            ...(venta.montoRecibidoCentavos !== undefined
              ? { montoRecibidoCentavos: venta.montoRecibidoCentavos }
              : {}),
            ...(venta.clienteId ? { clienteId: venta.clienteId } : {}),
            claveIdempotencia: venta.clave,
            vendidaEn: venta.vendidaEn,
          });
          modificarPendientes((cola) => cola.filter((v) => v.clave !== venta.clave));
          setSinConexion(false);
        } catch (err) {
          // Sigue sin red: se prueba en un rato, en el mismo orden.
          if (esFaltaDeConexion(err)) {
            setSinConexion(true);
            return;
          }
          // Sesión vencida que no se pudo renovar: al volver a entrar.
          if (err instanceof ApiError && err.statusCode === 401) return;
          // Falla del servidor (500, 502 mientras se actualiza) o demasiados
          // pedidos: no es un "no" a esta venta. Se prueba en un rato.
          if (err instanceof ApiError && (err.statusCode >= 500 || err.statusCode === 429)) {
            return;
          }
          const problema = err instanceof ApiError ? err.message : 'No se pudo enviar esta venta.';
          modificarPendientes((cola) =>
            cola.map((v) => (v.clave === venta.clave ? { ...v, problema } : v)),
          );
        }
      }
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }, [token, modificarPendientes]);

  const guardarVenta = useCallback(
    (venta: Omit<VentaPendiente, 'problema'>) => {
      modificarPendientes((cola) => [...cola, venta]);
    },
    [modificarPendientes],
  );

  const reintentar = useCallback(
    (clave: string) => {
      modificarPendientes((cola) =>
        cola.map((v) => (v.clave === clave ? { ...v, problema: undefined } : v)),
      );
      void enviarPendientes();
    },
    [modificarPendientes, enviarPendientes],
  );

  const descartar = useCallback(
    (clave: string) => {
      modificarPendientes((cola) => cola.filter((v) => v.clave !== clave));
    },
    [modificarPendientes],
  );

  // El navegador avisa cuando se va o vuelve la red: sin esperar al
  // próximo intento.
  useEffect(() => {
    const alVolver = () => {
      setSinConexion(false);
      void enviarPendientes();
    };
    const alIrse = () => setSinConexion(true);
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alIrse);
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alIrse);
    };
  }, [enviarPendientes]);

  // Se manda la cola al abrir la página, al volver a la pestaña y cada tanto.
  const hayPorMandar = pendientes.some((v) => !v.problema);
  useEffect(() => {
    if (!token || !hayPorMandar) return;
    void enviarPendientes();
    const intervalo = setInterval(() => void enviarPendientes(), CADA_MS);
    const alVolverALaPestana = () => {
      if (document.visibilityState === 'visible') void enviarPendientes();
    };
    document.addEventListener('visibilitychange', alVolverALaPestana);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverALaPestana);
    };
  }, [token, hayPorMandar, enviarPendientes]);

  // Sin conexión, cada tanto se prueba de nuevo (bajando el catálogo):
  // así la caja se entera sola de que volvió internet.
  useEffect(() => {
    if (!token || !sinConexion) return;
    const intervalo = setInterval(() => void actualizarCatalogo(), CADA_MS);
    return () => clearInterval(intervalo);
  }, [token, sinConexion, actualizarCatalogo]);

  const valor: ValorSinConexion = {
    sinConexion,
    pendientes,
    enviando,
    catalogo,
    ultimaCaja,
    marcarSinConexion: setSinConexion,
    recordarCaja,
    actualizarCatalogo,
    buscarEnCatalogo,
    descontarDelCatalogo,
    guardarVenta,
    enviarPendientes,
    reintentar,
    descartar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSinConexion(): ValorSinConexion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSinConexion va dentro de SinConexionProvider');
  return valor;
}
