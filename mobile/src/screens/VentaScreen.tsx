import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../lib/auth-context';
import {
  buscarPorCodigoBarras,
  crearProducto,
  crearVenta,
  obtenerCajaActual,
  ApiError,
} from '../lib/api';
import { buscarPorNombre, esCodigoInterno } from '../lib/filtro-productos';
import { formatearCantidad, importeCentavos, porPeso, precioPor, redondear } from '../lib/cantidad';
import { HojaPeso } from '../components/hoja-peso';
import { formatearCentavos, numeroDeTicket } from '../lib/formato';
import { compartirTicket } from '../lib/ticket-texto';
import { centavosATexto, montosRapidos } from '../lib/montos-rapidos';
import {
  AvisoDeCampo,
  Boton,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  estilosCampo,
} from '../components/ui';
import { aCentavos, avisoDelMargen } from '../lib/validacion';
import { FormularioAbrirCaja } from '../components/caja';
import { colores, espaciado, radios } from '../theme/colores';
import type { ClienteFiado, MetodoPago, Producto, TurnoCaja, Venta } from '../lib/tipos';
import { EscanerCamara } from '../components/escaner-camara';
import { CheckAnimado, CifraAnimada, Entrada, vibrar } from '../components/movimiento';
import { Banda, LabioHoja } from '../components/banda';
import { AvisoSinConexion } from '../components/aviso-sin-conexion';
import {
  esFaltaDeConexion,
  nuevaClave,
  useSinConexion,
  type VentaPendiente,
} from '../lib/sin-conexion';
import { SelectorCliente } from '../components/selector-cliente';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// --- Alta rápida de producto no encontrado durante la venta ---

function FormularioProductoNuevo({
  codigoBarras,
  nombreInicial = '',
  onCreado,
  onCancelar,
}: {
  // null: se buscó por nombre y no está (pan, huevos): va sin código.
  codigoBarras: string | null;
  nombreInicial?: string;
  onCreado: (producto: Producto) => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState(nombreInicial);
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), aCentavos(costoUnitario));

  async function manejarSubmit() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      const producto = await crearProducto(token, {
        codigoBarras: codigoBarras ?? undefined,
        nombre,
        precioVentaCentavos: Math.round(parseFloat(precioVenta || '0') * 100),
        costoUnitarioCentavos: costoUnitario ? Math.round(parseFloat(costoUnitario) * 100) : undefined,
        stockInicial: stockInicial ? parseInt(stockInicial, 10) : undefined,
      });
      onCreado(producto);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.formularioNuevo}>
      <Text style={styles.formularioNuevoTitulo}>Producto nuevo</Text>
      <Text style={styles.formularioNuevoCodigo}>{codigoBarras ?? 'Sin código'}</Text>
      <Text style={styles.formularioNuevoSubtitulo}>
        {codigoBarras
          ? 'Ese código no está en tu catálogo. Cárgalo y se agrega a la venta al instante.'
          : 'No hay ningún producto con ese nombre. Cárgalo sin código (la próxima vez lo encuentras por su nombre) y se agrega a la venta al instante.'}
      </Text>

      <Etiqueta>Nombre</Etiqueta>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        style={estilosCampo.input}
        placeholder="Coca Cola 500ml"
        autoFocus
      />
      <Etiqueta>Precio de venta</Etiqueta>
      <TextInput
        value={precioVenta}
        onChangeText={setPrecioVenta}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="1.50"
      />
      <Etiqueta>Costo unitario (opcional)</Etiqueta>
      <TextInput
        value={costoUnitario}
        onChangeText={setCostoUnitario}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="0.90"
      />
      <AvisoDeCampo advertencia={avisoMargen} />
      <Etiqueta>Stock inicial (opcional)</Etiqueta>
      <TextInput
        value={stockInicial}
        onChangeText={setStockInicial}
        keyboardType="number-pad"
        style={estilosCampo.input}
        placeholder="20"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!nombre || !precioVenta}
          style={{ flex: 1 }}
        >
          Crear y agregar
        </Boton>
        <Boton variante="ghost" onPress={onCancelar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </View>
  );
}

export function VentaScreen() {
  const { token, usuario } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [codigoInput, setCodigoInput] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  // Lo que se buscó y no está: el admin lo puede cargar ahí mismo.
  const [noEncontrado, setNoEncontrado] = useState<{ codigoBarras: string | null; nombre: string } | null>(null);
  // Algo que va por peso: se pregunta cuánto (o se cambia lo del carrito).
  const [pesando, setPesando] = useState<{ producto: Producto; cambiando: boolean } | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [confirmacionEscaneo, setConfirmacionEscaneo] = useState<string | null>(null);
  const confirmacionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sin caja abierta no se vende (undefined = todavía no se sabe).
  const [caja, setCaja] = useState<TurnoCaja | null | undefined>(undefined);
  const [errorCaja, setErrorCaja] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  // Al fiado: a quién (se elige al cobrar).
  const [clienteFiado, setClienteFiado] = useState<ClienteFiado | null>(null);
  // Para la confirmación: a quién se le fió la última venta.
  const [fiadoA, setFiadoA] = useState<string | null>(null);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<Venta | null>(null);
  // Cobrada sin conexión: guardada en el celular, se manda sola después.
  const [ventaGuardada, setVentaGuardada] = useState<VentaPendiente | null>(null);
  const {
    sinConexion,
    ultimaCaja,
    catalogo,
    marcarSinConexion,
    recordarCaja,
    actualizarCatalogo,
    buscarEnCatalogo,
    descontarDelCatalogo,
    guardarVenta,
  } = useSinConexion();

  const totalCentavos = carrito.reduce(
    (acc, item) => acc + importeCentavos(item.producto.precioVentaCentavos, item.cantidad),
    0,
  );
  const montoRecibidoCentavos = montoRecibido ? Math.round(parseFloat(montoRecibido) * 100) : null;

  // Solo números: un código. Con letras: un nombre, buscado en el catálogo
  // guardado (anda también sin conexión).
  const textoBuscado = codigoInput.trim();
  const buscaNombre = textoBuscado.length >= 2 && !/^\d+$/.test(textoBuscado);
  const sugerencias = buscaNombre && catalogo ? buscarPorNombre(catalogo.productos, textoBuscado, 6) : [];

  // Lo que no trae código (pan, huevos, lo suelto), a un toque.
  const sinCodigo = useMemo(
    () =>
      (catalogo?.productos ?? [])
        .filter((p) => esCodigoInterno(p.codigoBarras))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 12),
    [catalogo],
  );
  const vueltoCentavos = montoRecibidoCentavos !== null ? montoRecibidoCentavos - totalCentavos : null;
  // Lo que va por peso cuenta como una unidad.
  const unidadesEnCarrito = carrito.reduce((acc, i) => acc + (porPeso(i.producto.unidad) ? 1 : i.cantidad), 0);
  const efectivo = metodoPago === 'efectivo';
  const fiado = metodoPago === 'fiado';
  const puedeCobrar =
    carrito.length > 0 &&
    (fiado
      ? clienteFiado !== null
      : !efectivo || (montoRecibidoCentavos !== null && vueltoCentavos !== null && vueltoCentavos >= 0));

  // Cada vez que se vuelve a esta pestaña: la caja pudo cerrarse desde la
  // pantalla Caja (o el admin).
  // Por ref: revisar la caja la vuelve a recordar, y si esto fuera
  // dependencia de revisarCaja, cada revisión dispararía otra.
  const ultimaCajaRef = useRef(ultimaCaja);
  useEffect(() => {
    ultimaCajaRef.current = ultimaCaja;
  }, [ultimaCaja]);

  // Sin conexión se sigue con la caja como se vio la última vez, y con el
  // catálogo guardado.
  const revisarCaja = useCallback(() => {
    if (!token) return;
    setErrorCaja(null);
    obtenerCajaActual(token)
      .then((turno) => {
        setCaja(turno);
        recordarCaja(turno);
        marcarSinConexion(false);
        // Con conexión, el catálogo guardado se pone al día.
        void actualizarCatalogo();
      })
      .catch((err) => {
        if (esFaltaDeConexion(err)) {
          marcarSinConexion(true);
          if (ultimaCajaRef.current !== undefined) {
            setCaja(ultimaCajaRef.current);
            return;
          }
          setErrorCaja(
            'Sin conexión, y todavía no se sabe si tu caja está abierta. Conéctate una vez para empezar.',
          );
          return;
        }
        setErrorCaja(err instanceof ApiError ? err.message : 'No se pudo revisar la caja');
      });
  }, [token, recordarCaja, marcarSinConexion, actualizarCatalogo]);
  useFocusEffect(revisarCaja);

  // Si se cortó con la caja todavía sin saber, al llegar lo guardado se usa.
  useEffect(() => {
    if (sinConexion && caja === undefined && ultimaCaja !== undefined) {
      setCaja(ultimaCaja);
      setErrorCaja(null);
    }
  }, [sinConexion, caja, ultimaCaja]);

  function agregarAlCarrito(producto: Producto, cantidad = 1) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: redondear(i.cantidad + cantidad) } : i,
        );
      }
      return [...prev, { producto, cantidad }];
    });
  }

  function listoElPeso(cantidad: number) {
    if (!pesando) return;
    const { producto, cambiando } = pesando;
    if (cambiando) {
      setCarrito((prev) => prev.map((i) => (i.producto.id === producto.id ? { ...i, cantidad } : i)));
    } else {
      agregarAlCarrito(producto, cantidad);
      vibrar.toque();
    }
    setPesando(null);
  }

  /** Sin conexión: lo que queda del producto según el stock guardado. */
  function disponibleSinConexion(producto: Producto, sinContarElCarrito = false): number {
    const enCarrito = sinContarElCarrito ? 0 : (carrito.find((i) => i.producto.id === producto.id)?.cantidad ?? 0);
    return redondear(producto.stock - enCarrito);
  }

  /** Sin conexión: busca en el catálogo guardado y cuida el stock guardado. */
  function agregarDelCatalogoGuardado(codigo: string) {
    const producto = buscarEnCatalogo(codigo);
    if (!producto) {
      setCamaraActiva(false);
      setErrorBusqueda(
        `Sin conexión: el código ${codigo} no está en el catálogo guardado en este celular.`,
      );
      return;
    }
    agregarDelCatalogo(producto);
  }

  /**
   * Un producto elegido del catálogo (por nombre, o sin código). Sin
   * conexión, el stock guardado es lo único que se sabe: se cuida acá.
   */
  function agregarDelCatalogo(producto: Producto) {
    setErrorBusqueda(null);
    setNoEncontrado(null);
    if (!sinConexion) {
      confirmarAgregado(producto);
      return;
    }
    // Por unidad, que alcance una más; por peso, que quede algo (cuánto se
    // revisa al poner la cantidad).
    const queda = disponibleSinConexion(producto);
    if (porPeso(producto.unidad) ? queda <= 0 : queda < 1) {
      setCamaraActiva(false);
      setErrorBusqueda(
        producto.stock === 0
          ? `Según el último stock guardado, no queda ${producto.nombre}.`
          : `Según el último stock guardado, quedan ${formatearCantidad(producto.stock, producto.unidad)} de ${producto.nombre}.`,
      );
      return;
    }
    confirmarAgregado(producto);
  }

  function confirmarAgregado(producto: Producto) {
    // Por peso: primero cuánto (la cámara se cierra para ver la hoja).
    if (porPeso(producto.unidad)) {
      setCamaraActiva(false);
      setCodigoInput('');
      setPesando({ producto, cambiando: false });
      return;
    }
    agregarAlCarrito(producto);
    setCodigoInput('');
    setConfirmacionEscaneo(producto.nombre);
    if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current);
    confirmacionTimeoutRef.current = setTimeout(() => setConfirmacionEscaneo(null), 1200);
  }

  async function buscarYAgregar(codigo: string) {
    if (!token || !codigo.trim()) return;
    setErrorBusqueda(null);
    setNoEncontrado(null);
    // Un nombre con una sola coincidencia: esa. Con varias, se elige de la lista.
    if (buscaNombre && codigo === codigoInput && sugerencias.length > 0) {
      if (sugerencias.length === 1) agregarDelCatalogo(sugerencias[0]);
      return;
    }
    // Ya se sabe que no hay red: directo a lo guardado, sin esperar.
    if (sinConexion) {
      agregarDelCatalogoGuardado(codigo.trim());
      return;
    }
    try {
      const producto = await buscarPorCodigoBarras(token, codigo.trim());
      if (!producto) {
        // Igual que en el web: en vez de solo avisar, dejamos el código a
        // mano para ofrecer darlo de alta ahí mismo sin cortar la venta.
        // Acá SÍ cerramos la cámara: hace falta que el usuario complete
        // un formulario, cosa que no puede hacer mientras la cámara
        // ocupa toda la pantalla.
        setCamaraActiva(false);
        // Crear productos es del admin (el backend responde 403 a un
        // cajero): al cajero solo se le avisa.
        // Con letras se buscaba un nombre: el producto nuevo va sin código.
        const esNombre = !/^\d+$/.test(codigo.trim());
        if (usuario?.rol === 'admin') {
          setNoEncontrado(
            esNombre ? { codigoBarras: null, nombre: codigo.trim() } : { codigoBarras: codigo.trim(), nombre: '' },
          );
        } else {
          setErrorBusqueda(
            esNombre
              ? `No hay ningún producto que se llame “${codigo.trim()}”. Pídele al administrador que lo cargue.`
              : `El código ${codigo.trim()} no está en el catálogo. Pídele al administrador que lo cargue.`,
          );
        }
        return;
      }
      // La cámara se queda ABIERTA a propósito: el caso más común es
      // escanear varios productos seguidos sin reabrir la cámara cada
      // vez. El destello de confirmación es la única señal visible de
      // que el escaneo funcionó (mismo patrón que ya usa el web).
      confirmarAgregado(producto);
    } catch (err) {
      if (esFaltaDeConexion(err)) {
        marcarSinConexion(true);
        agregarDelCatalogoGuardado(codigo.trim());
        return;
      }
      // Un error sí amerita cerrar la cámara: el usuario necesita ver el
      // mensaje para decidir qué hacer, y ese mensaje vive fuera de la
      // vista de cámara.
      setCamaraActiva(false);
      setErrorBusqueda(err instanceof ApiError ? err.message : 'No se pudo buscar el producto');
    }
  }

  function manejarProductoNuevoCreado(producto: Producto) {
    agregarAlCarrito(producto);
    setNoEncontrado(null);
    setCodigoInput('');
    // Al catálogo guardado: así se lo encuentra por nombre ya mismo.
    void actualizarCatalogo();
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((i) => (i.producto.id === productoId ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  async function confirmarVenta() {
    if (!token || !puedeCobrar) return;
    setErrorVenta(null);
    // La clave y la hora se fijan ahora: si hay que mandarla después, es
    // la misma venta, cobrada en este momento.
    const clave = nuevaClave();
    const vendidaEn = new Date().toISOString();
    const items = carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad }));

    const limpiar = () => {
      setCarrito([]);
      setMontoRecibido('');
      setMetodoPago('efectivo');
      setFiadoA(clienteFiado?.nombre ?? null);
      setClienteFiado(null);
    };
    const guardarParaDespues = () => {
      const pendiente: VentaPendiente = {
        clave,
        vendidaEn,
        items: carrito.map((i) => ({
          productoId: i.producto.id,
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precioVentaCentavos: i.producto.precioVentaCentavos,
        })),
        metodoPago,
        ...(efectivo ? { montoRecibidoCentavos: montoRecibidoCentavos! } : {}),
        ...(fiado && clienteFiado ? { clienteId: clienteFiado.id, clienteNombre: clienteFiado.nombre } : {}),
        totalCentavos,
      };
      guardarVenta(pendiente);
      descontarDelCatalogo(items);
      setVentaGuardada(pendiente);
      vibrar.exito();
      limpiar();
    };

    if (sinConexion) {
      guardarParaDespues();
      return;
    }

    setProcesando(true);
    try {
      const venta = await crearVenta(token, {
        items,
        metodoPago,
        ...(efectivo ? { montoRecibidoCentavos: montoRecibidoCentavos! } : {}),
        ...(fiado && clienteFiado ? { clienteId: clienteFiado.id } : {}),
        claveIdempotencia: clave,
        vendidaEn,
      });
      setVentaConfirmada(venta);
      descontarDelCatalogo(items);
      vibrar.exito();
      limpiar();
    } catch (err) {
      // Se cortó (o no respondió a tiempo): queda guardada y se manda
      // sola. Si en realidad sí llegó, la clave evita cobrarla dos veces.
      if (esFaltaDeConexion(err)) {
        marcarSinConexion(true);
        guardarParaDespues();
        return;
      }
      // La caja se cerró mientras tanto: volver a pedir que se abra.
      if (err instanceof ApiError && err.statusCode === 409) {
        setCaja(null);
        return;
      }
      setErrorVenta(err instanceof ApiError ? err.message : 'No se pudo registrar la venta');
    } finally {
      setProcesando(false);
    }
  }

  if (ventaConfirmada) {
    return (
      <SafeAreaView style={styles.contenedor} edges={[]}>
        <View style={styles.confirmacionContenedor}>
          <CheckAnimado color={colores.verdeGanancia} />
          <Text style={styles.confirmacionEtiqueta}>
            VENTA REGISTRADA · TICKET {numeroDeTicket(ventaConfirmada.numero)}
          </Text>
          <CifraAnimada
            texto={formatearCentavos(ventaConfirmada.totalCentavos)}
            style={styles.confirmacionTotal}
          />

          <Entrada orden={3} style={styles.confirmacionTarjeta}>
            <View style={styles.confirmacionFila}>
              <Text style={styles.confirmacionLabel}>Subtotal</Text>
              <Text style={styles.confirmacionValor}>
                {formatearCentavos(ventaConfirmada.subtotalCentavos)}
              </Text>
            </View>
            <View style={styles.confirmacionFila}>
              <Text style={styles.confirmacionLabel}>IVA</Text>
              <Text style={styles.confirmacionValor}>
                {formatearCentavos(ventaConfirmada.ivaCentavos)}
              </Text>
            </View>
            <View style={styles.confirmacionDivisor} />
            {ventaConfirmada.metodoPago === 'fiado' ? (
              <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                Anotado al fiado de {fiadoA ?? 'el cliente'}. Queda en su cuenta, en Fiados.
              </Text>
            ) : ventaConfirmada.metodoPago === 'transferencia' ? (
              <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                Pagado por transferencia
              </Text>
            ) : (
              <>
                <View style={styles.confirmacionFila}>
                  <Text style={styles.confirmacionLabel}>Recibido</Text>
                  <Text style={styles.confirmacionValor}>
                    {formatearCentavos(ventaConfirmada.montoRecibidoCentavos)}
                  </Text>
                </View>
                <View style={styles.confirmacionFila}>
                  <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                    Vuelto
                  </Text>
                  <CifraAnimada
                    texto={formatearCentavos(ventaConfirmada.vueltoCentavos)}
                    style={[styles.confirmacionValor, { color: colores.ambar, fontSize: 19, fontWeight: '800' }]}
                  />
                </View>
              </>
            )}
          </Entrada>

          <Entrada orden={5} style={{ width: '100%' }}>
            <Boton onPress={() => setVentaConfirmada(null)} style={{ marginTop: espaciado.lg, width: '100%' }}>
              Nueva venta
            </Boton>
            <Boton
              variante="secondary"
              onPress={() => token && compartirTicket(token, ventaConfirmada.id)}
              style={{ marginTop: espaciado.sm, width: '100%' }}
            >
              Compartir ticket
            </Boton>
          </Entrada>
        </View>
      </SafeAreaView>
    );
  }

  if (ventaGuardada) {
    const vuelto =
      ventaGuardada.montoRecibidoCentavos !== undefined
        ? ventaGuardada.montoRecibidoCentavos - ventaGuardada.totalCentavos
        : null;
    return (
      <SafeAreaView style={styles.contenedor} edges={[]}>
        <View style={styles.confirmacionContenedor}>
          <CheckAnimado color={colores.ambar} />
          <Text style={styles.confirmacionEtiqueta}>VENTA GUARDADA SIN CONEXIÓN</Text>
          <CifraAnimada
            texto={formatearCentavos(ventaGuardada.totalCentavos)}
            style={styles.confirmacionTotal}
          />

          <Entrada orden={3} style={styles.confirmacionTarjeta}>
            {ventaGuardada.metodoPago === 'fiado' ? (
              <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                Al fiado · {ventaGuardada.clienteNombre}
              </Text>
            ) : vuelto === null ? (
              <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                Pagado por transferencia
              </Text>
            ) : (
              <>
                <View style={styles.confirmacionFila}>
                  <Text style={styles.confirmacionLabel}>Recibido</Text>
                  <Text style={styles.confirmacionValor}>
                    {formatearCentavos(ventaGuardada.montoRecibidoCentavos!)}
                  </Text>
                </View>
                <View style={styles.confirmacionFila}>
                  <Text style={[styles.confirmacionLabel, { fontWeight: '700', color: colores.tinta }]}>
                    Vuelto
                  </Text>
                  <CifraAnimada
                    texto={formatearCentavos(vuelto)}
                    style={[styles.confirmacionValor, { color: colores.ambar, fontSize: 19, fontWeight: '800' }]}
                  />
                </View>
              </>
            )}
            <View style={styles.confirmacionDivisor} />
            <Text style={styles.confirmacionLabel}>
              Se envía sola cuando vuelva internet, con la hora de ahora. El número de ticket se le
              asigna al enviarla.
            </Text>
          </Entrada>

          <Entrada orden={5} style={{ width: '100%' }}>
            <Boton onPress={() => setVentaGuardada(null)} style={{ marginTop: espaciado.lg, width: '100%' }}>
              Nueva venta
            </Boton>
          </Entrada>
        </View>
      </SafeAreaView>
    );
  }

  if (!caja) {
    return (
      <SafeAreaView style={styles.contenedor} edges={[]}>
        <Banda
          eyebrow="Caja"
          titulo="Vender"
          detalle={caja === null ? 'Tu caja está cerrada. Ábrela para empezar a cobrar.' : undefined}
        />
        <LabioHoja />
        <View style={{ paddingHorizontal: espaciado.lg }}>
          {errorCaja && <EstadoError mensaje={errorCaja} onReintentar={revisarCaja} />}
          {caja === undefined && !errorCaja && <EstadoCargando texto="Revisando la caja…" />}
          {caja === null && (
            <FormularioAbrirCaja
              onAbierta={(turno) => {
                setCaja(turno);
                // Así, si se corta enseguida, se sabe que está abierta.
                recordarCaja(turno);
              }}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const encabezadoYEntrada = (
    <View>
      <Banda
        eyebrow="Caja"
        titulo="Vender"
        valor={formatearCentavos(totalCentavos)}
        detalle={
          carrito.length === 0
            ? 'Escanea un producto para empezar el ticket.'
            : `Total a cobrar · ${unidadesEnCarrito} unidad${unidadesEnCarrito === 1 ? '' : 'es'}`
        }
        accion={
          <View style={{ flexDirection: 'row', gap: espaciado.xs }}>
            <Pressable
              onPress={() => navigation.navigate('Caja')}
              style={styles.botonVentasHoy}
              hitSlop={8}
              accessibilityLabel="Mi caja"
            >
              <Ionicons name="cash-outline" size={18} color={colores.papel} />
              <Text style={styles.botonVentasHoyTexto}>Caja</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('VentasHoy')}
              style={styles.botonVentasHoy}
              hitSlop={8}
            >
              <Ionicons name="receipt-outline" size={18} color={colores.papel} />
              <Text style={styles.botonVentasHoyTexto}>Hoy</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Fiados')}
              style={styles.botonVentasHoy}
              hitSlop={8}
            >
              <Ionicons name="book-outline" size={18} color={colores.papel} />
              <Text style={styles.botonVentasHoyTexto}>Fiados</Text>
            </Pressable>
          </View>
        }
      />
      <LabioHoja />
      <AvisoSinConexion />

      {camaraActiva ? (
        <EscanerCamara
          onDetectado={(codigo) => buscarYAgregar(codigo)}
          onCerrar={() => setCamaraActiva(false)}
          confirmacion={confirmacionEscaneo}
        />
      ) : (
        <View style={{ paddingHorizontal: espaciado.lg }}>
          <Pressable onPress={() => setCamaraActiva(true)} style={styles.escanear}>
            <Ionicons name="barcode-outline" size={24} color={colores.papel} />
            <Text style={styles.escanearTexto}>Escanear producto</Text>
          </Pressable>

          <View style={styles.separadorO}>
            <View style={styles.separadorLinea} />
            <Text style={styles.separadorTexto}>o busca por código o nombre</Text>
            <View style={styles.separadorLinea} />
          </View>

          <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
            <TextInput
              value={codigoInput}
              onChangeText={setCodigoInput}
              onSubmitEditing={() => buscarYAgregar(codigoInput)}
              style={[estilosCampo.input, { flex: 1, marginBottom: 0 }]}
              placeholder="7861001234567 o pan"
              autoCorrect={false}
              returnKeyType="search"
            />
            <Boton
              variante="secondary"
              onPress={() => buscarYAgregar(codigoInput)}
              disabled={!codigoInput.trim()}
              style={{ paddingHorizontal: espaciado.lg }}
            >
              Agregar
            </Boton>
          </View>
          {sugerencias.length > 0 && (
            <View style={styles.sugerencias} accessibilityLabel="Productos que coinciden">
              {sugerencias.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => agregarDelCatalogo(p)}
                  style={({ pressed }) => [
                    styles.sugerencia,
                    i > 0 && styles.sugerenciaBorde,
                    pressed && { backgroundColor: colores.papel },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.sugerenciaNombre} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                  <Text style={styles.sugerenciaDetalle}>
                    {formatearCentavos(p.precioVentaCentavos)} · stock {p.stock}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {errorBusqueda && <Text style={[styles.error, { marginTop: espaciado.sm }]}>{errorBusqueda}</Text>}

          {noEncontrado && (
            <FormularioProductoNuevo
              // Otro producto no encontrado: el formulario empieza de cero.
              key={`${noEncontrado.codigoBarras}-${noEncontrado.nombre}`}
              codigoBarras={noEncontrado.codigoBarras}
              nombreInicial={noEncontrado.nombre}
              onCreado={manejarProductoNuevoCreado}
              onCancelar={() => setNoEncontrado(null)}
            />
          )}

          {sinCodigo.length > 0 && !noEncontrado && (
            <View style={{ marginTop: espaciado.md }}>
              <Etiqueta>Sin código de barras</Etiqueta>
              <View style={styles.chipsSinCodigo}>
                {sinCodigo.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => agregarDelCatalogo(p)}
                    style={({ pressed }) => [styles.chipSinCodigo, pressed && { borderColor: colores.tinta }]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipSinCodigoNombre}>{p.nombre}</Text>
                    <Text style={styles.chipSinCodigoPrecio}>{formatearCentavos(p.precioVentaCentavos)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const piePagina =
    carrito.length === 0 ? null : (
      <View style={styles.footer}>
        <Etiqueta>Cómo paga</Etiqueta>
        <View style={styles.metodos} accessibilityRole="radiogroup">
          {(
            [
              ['efectivo', 'Efectivo'],
              ['transferencia', 'Transferencia'],
              ['fiado', 'Fiado'],
            ] as const
          ).map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => {
                setMetodoPago(valor);
                setErrorVenta(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: metodoPago === valor }}
              style={[styles.metodo, metodoPago === valor && styles.metodoActivo]}
            >
              {/* Tres opciones: en un celular angosto, el texto se achica en vez de cortarse. */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.metodoTexto, metodoPago === valor && styles.metodoTextoActivo]}
              >
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>

        {fiado && (
          <View style={{ marginBottom: espaciado.sm }}>
            <SelectorCliente elegido={clienteFiado} onElegir={setClienteFiado} />
            {clienteFiado && (
              <Text style={styles.avisoTransferencia}>
                {formatearCentavos(totalCentavos)} se anotan en su cuenta. No entra nada al cajón.
              </Text>
            )}
          </View>
        )}

        {metodoPago === 'transferencia' && (
          <Text style={styles.avisoTransferencia}>
            Confirma en el celular que llegó la transferencia de {formatearCentavos(totalCentavos)} antes de
            entregar. No entra al cajón.
          </Text>
        )}

        {efectivo && (
        <>
        <Etiqueta>Monto recibido</Etiqueta>
        <TextInput
          value={montoRecibido}
          onChangeText={setMontoRecibido}
          keyboardType="decimal-pad"
          style={estilosCampo.input}
          placeholder="0.00"
        />
        {/* Cobro rápido: la mayoría de las ventas se pagan con el monto
            exacto o con un billete, sin tener que tipear. */}
        <View style={styles.montosRapidos}>
          {[totalCentavos, ...montosRapidos(totalCentavos)].map((centavos, i) => {
            const activo = montoRecibidoCentavos === centavos;
            return (
              <Pressable
                key={centavos}
                onPress={() => setMontoRecibido(centavosATexto(centavos))}
                style={[styles.montoRapido, activo && styles.montoRapidoActivo]}
              >
                <Text style={[styles.montoRapidoTexto, activo && styles.montoRapidoTextoActivo]}>
                  {i === 0 ? 'Exacto' : formatearCentavos(centavos)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {vueltoCentavos !== null && (
          <View
            style={[
              styles.vueltoCaja,
              {
                backgroundColor:
                  vueltoCentavos >= 0 ? 'rgba(217,140,43,0.12)' : 'rgba(182,70,47,0.1)',
              },
            ]}
          >
            <Text style={styles.footerVueltoLabel}>{vueltoCentavos >= 0 ? 'Vuelto' : 'Falta'}</Text>
            <Text
              style={[
                styles.footerVueltoValor,
                { color: vueltoCentavos >= 0 ? colores.ambar : colores.rojoPerdida },
              ]}
            >
              {formatearCentavos(Math.abs(vueltoCentavos))}
            </Text>
          </View>
        )}
        </>
        )}

        {errorVenta && <Text style={styles.error}>{errorVenta}</Text>}

        <Boton
          variante="success"
          onPress={confirmarVenta}
          cargando={procesando}
          disabled={!puedeCobrar}
          style={{ marginTop: espaciado.sm }}
        >
          {efectivo ? 'Confirmar venta' : fiado ? 'Anotar al fiado' : 'Cobrar por transferencia'}
        </Boton>

        <Pressable
          onPress={() =>
            Alert.alert('Vaciar carrito', 'Se quitan todos los productos de esta venta.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Vaciar',
                style: 'destructive',
                onPress: () => {
                  setCarrito([]);
                  setMontoRecibido('');
                  setErrorVenta(null);
                },
              },
            ])
          }
          disabled={procesando}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: espaciado.md }}
        >
          <Text style={styles.vaciarTexto}>Vaciar carrito</Text>
        </Pressable>
      </View>
    );

  return (
    <SafeAreaView style={styles.contenedor} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/*
          TODO junto en un solo FlatList (header + cámara arriba, carrito
          en el medio, total/monto/confirmar abajo) para que la pantalla
          entera se desplace como una unidad. Antes eran bloques sueltos
          apilados fuera de cualquier contenedor con scroll: si la cámara
          + el carrito + el teclado no entraban en la pantalla, el campo
          "Monto recibido" quedaba fuera de vista sin ninguna forma de
          bajar para alcanzarlo — ese era el bug real.
        */}
        <FlatList
          data={carrito}
          keyExtractor={(i) => i.producto.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          ListHeaderComponent={encabezadoYEntrada}
          ListFooterComponent={piePagina}
          ListEmptyComponent={
            <EstadoVacio
              icono="cart-outline"
              titulo="El carrito está vacío"
              descripcion="Escanea o escribe un código para empezar."
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.itemCarrito, { marginHorizontal: espaciado.lg }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNombre} numberOfLines={1}>
                  {item.producto.nombre}
                </Text>
                <Text style={styles.itemPrecioUnitario}>
                  {formatearCentavos(item.producto.precioVentaCentavos)}
                  {porPeso(item.producto.unidad) ? precioPor(item.producto.unidad) : ' c/u'}
                </Text>
              </View>
              {porPeso(item.producto.unidad) ? (
                <Pressable
                  onPress={() => setPesando({ producto: item.producto, cambiando: true })}
                  style={styles.botonPeso}
                  accessibilityRole="button"
                  accessibilityLabel={`Cambiar cuánto de ${item.producto.nombre}`}
                >
                  <Text style={styles.cantidadTexto}>{formatearCantidad(item.cantidad, item.producto.unidad)}</Text>
                </Pressable>
              ) : (
              <View style={styles.contadorCantidad}>
                <Pressable
                  onPress={() => cambiarCantidad(item.producto.id, -1)}
                  style={styles.botonCantidad}
                  hitSlop={6}
                  accessibilityLabel={`Quitar una unidad de ${item.producto.nombre}`}
                >
                  <Ionicons name="remove" size={18} color={colores.tinta} />
                </Pressable>
                <Text style={styles.cantidadTexto}>{item.cantidad}</Text>
                <Pressable
                  onPress={() => cambiarCantidad(item.producto.id, 1)}
                  style={styles.botonCantidad}
                  hitSlop={6}
                  accessibilityLabel={`Agregar una unidad de ${item.producto.nombre}`}
                >
                  <Ionicons name="add" size={18} color={colores.tinta} />
                </Pressable>
              </View>
              )}
              <Text style={styles.subtotalTexto}>
                {formatearCentavos(importeCentavos(item.producto.precioVentaCentavos, item.cantidad))}
              </Text>
            </View>
          )}
        />
      </KeyboardAvoidingView>

      {pesando && (
        <HojaPeso
          // Otro producto: la hoja empieza de cero.
          key={`${pesando.producto.id}-${pesando.cambiando}`}
          producto={pesando.producto}
          inicial={
            pesando.cambiando ? carrito.find((i) => i.producto.id === pesando.producto.id)?.cantidad : undefined
          }
          maximo={sinConexion ? disponibleSinConexion(pesando.producto, pesando.cambiando) : undefined}
          onListo={listoElPeso}
          onCerrar={() => setPesando(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  botonPeso: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
  },
  sugerencias: {
    marginTop: espaciado.sm,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaciado.sm,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm + 4,
  },
  sugerenciaBorde: { borderTopWidth: 1, borderTopColor: colores.papelLinea },
  sugerenciaNombre: { flex: 1, fontSize: 14, color: colores.tinta, fontWeight: '600' },
  sugerenciaDetalle: { fontSize: 12, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  chipsSinCodigo: { flexDirection: 'row', flexWrap: 'wrap', gap: espaciado.sm },
  chipSinCodigo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
  },
  chipSinCodigoNombre: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  chipSinCodigoPrecio: { fontSize: 12, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  metodos: { flexDirection: 'row', gap: espaciado.sm, marginBottom: espaciado.md },
  metodo: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  metodoActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  metodoTexto: { fontSize: 14, fontWeight: '700', color: colores.tinta },
  metodoTextoActivo: { color: colores.papel },
  avisoTransferencia: {
    fontSize: 13,
    lineHeight: 18,
    color: colores.tinta,
    backgroundColor: colores.papel,
    borderRadius: radios.md,
    padding: espaciado.md,
    marginBottom: espaciado.sm,
  },
  montosRapidos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaciado.xs, marginBottom: espaciado.sm },
  montoRapido: {
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.blanco,
  },
  montoRapidoActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  montoRapidoTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  montoRapidoTextoActivo: { color: colores.papel },
  vaciarTexto: { fontSize: 13, color: colores.tintaSuave, fontWeight: '600', textDecorationLine: 'underline' },
  botonVentasHoy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.xs,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: 'rgba(246,243,236,0.35)',
  },
  botonVentasHoyTexto: { fontSize: 12, fontWeight: '700', color: colores.papel },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  error: { color: colores.rojoPerdida, fontSize: 13, marginVertical: espaciado.xs },
  escanear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaciado.sm,
    minHeight: 56,
    borderRadius: radios.lg,
    backgroundColor: colores.tinta,
  },
  escanearTexto: { fontSize: 16, fontWeight: '700', color: colores.papel },
  separadorO: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    marginVertical: espaciado.md,
  },
  separadorLinea: { flex: 1, height: 1, backgroundColor: colores.papelLinea },
  separadorTexto: { fontSize: 12, color: colores.tintaSuave },
  itemCarrito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    paddingVertical: espaciado.md,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  itemNombre: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  itemPrecioUnitario: { fontSize: 12, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  contadorCantidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    padding: 2,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  botonCantidad: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.full,
  },
  cantidadTexto: {
    width: 22,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
  subtotalTexto: {
    width: 70,
    textAlign: 'right',
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
  },
  footer: {
    padding: espaciado.lg,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  footerFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: espaciado.sm },
  footerTotalLabel: { fontSize: 15, fontWeight: '600', color: colores.tinta },
  footerTotalValor: {
    fontSize: 26,
    fontWeight: '800',
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
  vueltoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
    borderRadius: radios.md,
    marginBottom: espaciado.sm,
  },
  footerVueltoLabel: { fontSize: 14, fontWeight: '600', color: colores.tinta },
  footerVueltoValor: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  formularioNuevo: {
    marginTop: espaciado.sm,
    marginBottom: espaciado.md,
    padding: espaciado.lg,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  formularioNuevoTitulo: { fontSize: 15, fontWeight: '700', color: colores.tinta },
  formularioNuevoCodigo: {
    fontSize: 13,
    color: colores.tintaSuave,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  formularioNuevoSubtitulo: {
    fontSize: 12,
    color: colores.tintaSuave,
    marginTop: espaciado.xs,
    marginBottom: espaciado.md,
  },
  confirmacionContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaciado.xl,
  },
  confirmacionIconoFondo: {
    width: 64,
    height: 64,
    borderRadius: radios.full,
    backgroundColor: 'rgba(47,111,79,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaciado.sm,
  },
  confirmacionEtiqueta: { fontSize: 12, fontWeight: '700', color: colores.verdeGanancia, letterSpacing: 0.5 },
  confirmacionTotal: { fontSize: 36, fontWeight: '800', color: colores.tinta, marginTop: espaciado.sm, marginBottom: espaciado.lg },
  confirmacionTarjeta: {
    width: '100%',
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    padding: espaciado.lg,
  },
  confirmacionFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: espaciado.xs,
  },
  confirmacionLabel: { fontSize: 14, color: colores.tintaSuave },
  confirmacionValor: { fontSize: 14, color: colores.tinta, fontVariant: ['tabular-nums'] },
  confirmacionDivisor: { height: 1, backgroundColor: colores.papelLinea, marginVertical: espaciado.sm },
});