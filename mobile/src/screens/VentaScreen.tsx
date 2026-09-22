import { useRef, useState } from 'react';
import {
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
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../lib/auth-context';
import { buscarPorCodigoBarras, crearProducto, crearVenta, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { Boton, EncabezadoPantalla, EstadoVacio, Etiqueta, estilosCampo } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { Producto, Venta } from '../lib/tipos';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// La cámara solo detecta estos formatos — son los que efectivamente
// aparecen en productos de supermercado/almacén (ver spec 3.1).
const TIPOS_CODIGO_BARRAS = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

// IMPORTANTE: este objeto debe ser una referencia ESTABLE, no crearse
// dentro del render. Si se recrea en cada render (ej. `{ barcodeTypes:
// [...TIPOS_CODIGO_BARRAS] }` inline en el JSX), CameraView interpreta
// que la config de escaneo "cambió" y reinicia el detector nativo cada
// vez que la pantalla re-renderiza por cualquier motivo — incluso uno
// sin relación con la cámara — y el escaneo nunca llega a estabilizarse
// lo suficiente para reportar una lectura. Este fue el bug real detrás
// de "el sensor no hace nada": si tipeabas algo, cambiaba cualquier
// estado de VentaScreen mientras la cámara estaba abierta, el escáner
// se reiniciaba en loop.
const CONFIGURACION_ESCANER = { barcodeTypes: [...TIPOS_CODIGO_BARRAS] };

function EscanerCamara({
  onDetectado,
  onCerrar,
  confirmacion,
}: {
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
  confirmacion: string | null;
}) {
  const [permiso, solicitarPermiso] = useCameraPermissions();
  // Evita disparar el mismo código repetidamente mientras la cámara sigue
  // detectando el mismo código de barras en frames consecutivos.
  const ultimoDetectadoRef = useRef<{ codigo: string; ts: number } | null>(null);

  function manejarEscaneo(resultado: BarcodeScanningResult) {
    const ahora = Date.now();
    const ultimo = ultimoDetectadoRef.current;
    if (ultimo && ultimo.codigo === resultado.data && ahora - ultimo.ts < 2000) {
      return;
    }
    ultimoDetectadoRef.current = { codigo: resultado.data, ts: ahora };
    onDetectado(resultado.data);
  }

  if (!permiso) {
    return null;
  }

  if (!permiso.granted) {
    return (
      <View style={styles.camaraPermisoContenedor}>
        <Text style={styles.camaraPermisoTexto}>
          KontaGo necesita acceso a la cámara para escanear códigos de barras.
        </Text>
        <Boton onPress={solicitarPermiso} style={{ marginTop: espaciado.sm }}>
          Dar permiso
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ marginTop: espaciado.xs }}>
          Cancelar
        </Boton>
      </View>
    );
  }

  return (
    <View style={styles.camaraContenedor}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={CONFIGURACION_ESCANER}
        onBarcodeScanned={manejarEscaneo}
      />
      <View style={styles.camaraOverlay}>
        <View style={styles.camaraMarco} />
      </View>
      {confirmacion && (
        <View style={styles.confirmacionFlash}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.confirmacionFlashTexto} numberOfLines={1}>
            {confirmacion}
          </Text>
        </View>
      )}
      <Boton variante="secondary" onPress={onCerrar} style={styles.camaraCerrar}>
        Cerrar cámara
      </Boton>
    </View>
  );
}

// --- Alta rápida de producto no encontrado durante la venta ---

function FormularioProductoNuevo({
  codigoBarras,
  onCreado,
  onCancelar,
}: {
  codigoBarras: string;
  onCreado: (producto: Producto) => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      const producto = await crearProducto(token, {
        codigoBarras,
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
      <Text style={styles.formularioNuevoCodigo}>{codigoBarras}</Text>
      <Text style={styles.formularioNuevoSubtitulo}>
        Ese código no está en tu catálogo. Cargalo y se agrega a la venta al instante.
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
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [confirmacionEscaneo, setConfirmacionEscaneo] = useState<string | null>(null);
  const confirmacionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [montoRecibido, setMontoRecibido] = useState('');
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<Venta | null>(null);

  const totalCentavos = carrito.reduce(
    (acc, item) => acc + item.producto.precioVentaCentavos * item.cantidad,
    0,
  );
  const montoRecibidoCentavos = montoRecibido ? Math.round(parseFloat(montoRecibido) * 100) : null;
  const vueltoCentavos = montoRecibidoCentavos !== null ? montoRecibidoCentavos - totalCentavos : null;

  function agregarAlCarrito(producto: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  async function buscarYAgregar(codigo: string) {
    if (!token || !codigo.trim()) return;
    setErrorBusqueda(null);
    setCodigoNoEncontrado(null);
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
        if (usuario?.rol === 'admin') {
          setCodigoNoEncontrado(codigo.trim());
        } else {
          setErrorBusqueda(
            `El código ${codigo.trim()} no está en el catálogo. Pedile al administrador que lo cargue.`,
          );
        }
        return;
      }
      // La cámara se queda ABIERTA a propósito: el caso más común es
      // escanear varios productos seguidos sin reabrir la cámara cada
      // vez. El destello de confirmación es la única señal visible de
      // que el escaneo funcionó (mismo patrón que ya usa el web).
      agregarAlCarrito(producto);
      setCodigoInput('');
      setConfirmacionEscaneo(producto.nombre);
      if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current);
      confirmacionTimeoutRef.current = setTimeout(() => setConfirmacionEscaneo(null), 1200);
    } catch (err) {
      // Un error sí amerita cerrar la cámara: el usuario necesita ver el
      // mensaje para decidir qué hacer, y ese mensaje vive fuera de la
      // vista de cámara.
      setCamaraActiva(false);
      setErrorBusqueda(err instanceof ApiError ? err.message : 'No se pudo buscar el producto');
    }
  }

  function manejarProductoNuevoCreado(producto: Producto) {
    agregarAlCarrito(producto);
    setCodigoNoEncontrado(null);
    setCodigoInput('');
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((i) => (i.producto.id === productoId ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  async function confirmarVenta() {
    if (!token || carrito.length === 0 || montoRecibidoCentavos === null) return;
    setErrorVenta(null);
    setProcesando(true);
    try {
      const venta = await crearVenta(token, {
        items: carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad })),
        montoRecibidoCentavos,
      });
      setVentaConfirmada(venta);
      setCarrito([]);
      setMontoRecibido('');
    } catch (err) {
      setErrorVenta(err instanceof ApiError ? err.message : 'No se pudo registrar la venta');
    } finally {
      setProcesando(false);
    }
  }

  if (ventaConfirmada) {
    return (
      <SafeAreaView style={styles.contenedor} edges={[]}>
        <View style={styles.confirmacionContenedor}>
          <View style={styles.confirmacionIconoFondo}>
            <Ionicons name="checkmark" size={32} color={colores.verdeGanancia} />
          </View>
          <Text style={styles.confirmacionEtiqueta}>VENTA REGISTRADA</Text>
          <Text style={styles.confirmacionTotal}>
            {formatearCentavos(ventaConfirmada.totalCentavos)}
          </Text>

          <View style={styles.confirmacionTarjeta}>
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
              <Text style={[styles.confirmacionValor, { color: colores.ambar, fontSize: 19, fontWeight: '800' }]}>
                {formatearCentavos(ventaConfirmada.vueltoCentavos)}
              </Text>
            </View>
          </View>

          <Boton onPress={() => setVentaConfirmada(null)} style={{ marginTop: espaciado.lg, width: '100%' }}>
            Nueva venta
          </Boton>
        </View>
      </SafeAreaView>
    );
  }

  const encabezadoYEntrada = (
    <View>
      <EncabezadoPantalla
        eyebrow="CAJA"
        titulo="Vender"
        accion={
          <Pressable
            onPress={() => navigation.navigate('VentasHoy')}
            style={styles.botonVentasHoy}
            hitSlop={8}
          >
            <Ionicons name="receipt-outline" size={18} color={colores.tinta} />
            <Text style={styles.botonVentasHoyTexto}>Ventas de hoy</Text>
          </Pressable>
        }
      />

      {camaraActiva ? (
        <EscanerCamara
          onDetectado={(codigo) => buscarYAgregar(codigo)}
          onCerrar={() => setCamaraActiva(false)}
          confirmacion={confirmacionEscaneo}
        />
      ) : (
        <View style={{ paddingHorizontal: espaciado.lg }}>
          <Etiqueta>Código de barras</Etiqueta>
          <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
            <TextInput
              value={codigoInput}
              onChangeText={setCodigoInput}
              onSubmitEditing={() => buscarYAgregar(codigoInput)}
              style={[estilosCampo.input, { flex: 1 }]}
              placeholder="Tipeá el código"
              keyboardType="number-pad"
            />
            <Boton onPress={() => buscarYAgregar(codigoInput)} style={{ paddingHorizontal: espaciado.lg }}>
              +
            </Boton>
          </View>
          {errorBusqueda && <Text style={styles.error}>{errorBusqueda}</Text>}

          {codigoNoEncontrado && (
            <FormularioProductoNuevo
              codigoBarras={codigoNoEncontrado}
              onCreado={manejarProductoNuevoCreado}
              onCancelar={() => setCodigoNoEncontrado(null)}
            />
          )}

          <Boton variante="secondary" onPress={() => setCamaraActiva(true)} style={{ marginBottom: espaciado.md }}>
            Escanear con la cámara
          </Boton>
        </View>
      )}
    </View>
  );

  const piePagina =
    carrito.length === 0 ? null : (
      <View style={styles.footer}>
        <View style={styles.footerFila}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalValor}>{formatearCentavos(totalCentavos)}</Text>
        </View>

        <Etiqueta>Monto recibido</Etiqueta>
        <TextInput
          value={montoRecibido}
          onChangeText={setMontoRecibido}
          keyboardType="decimal-pad"
          style={estilosCampo.input}
          placeholder="0.00"
        />

        {vueltoCentavos !== null && (
          <View style={styles.footerFila}>
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

        {errorVenta && <Text style={styles.error}>{errorVenta}</Text>}

        <Boton
          variante="success"
          onPress={confirmarVenta}
          cargando={procesando}
          disabled={montoRecibidoCentavos === null || vueltoCentavos === null || vueltoCentavos < 0}
          style={{ marginTop: espaciado.sm }}
        >
          Confirmar venta
        </Boton>
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
              descripcion="Escaneá o tipeá un código para empezar."
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.itemCarrito, { marginHorizontal: espaciado.lg }]}>
              <Text style={{ flex: 1, color: colores.tinta, fontSize: 14 }}>{item.producto.nombre}</Text>
              <Boton variante="ghost" onPress={() => cambiarCantidad(item.producto.id, -1)} style={styles.botonCantidad}>
                −
              </Boton>
              <Text style={styles.cantidadTexto}>{item.cantidad}</Text>
              <Boton variante="ghost" onPress={() => cambiarCantidad(item.producto.id, 1)} style={styles.botonCantidad}>
                +
              </Boton>
              <Text style={styles.subtotalTexto}>
                {formatearCentavos(item.producto.precioVentaCentavos * item.cantidad)}
              </Text>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  botonVentasHoy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    paddingHorizontal: espaciado.sm,
    paddingVertical: espaciado.xs,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  botonVentasHoyTexto: { fontSize: 12, fontWeight: '600', color: colores.tinta },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  error: { color: colores.rojoPerdida, fontSize: 13, marginVertical: espaciado.xs },
  itemCarrito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    paddingVertical: espaciado.sm,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  botonCantidad: { minHeight: 28, paddingVertical: 0, paddingHorizontal: espaciado.sm },
  cantidadTexto: { width: 20, textAlign: 'center', color: colores.tinta, fontVariant: ['tabular-nums'] },
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
  footerTotalValor: { fontSize: 20, fontWeight: '700', color: colores.tinta },
  footerVueltoLabel: { fontSize: 14, color: colores.tintaSuave },
  footerVueltoValor: { fontSize: 17, fontWeight: '700' },
  camaraContenedor: { height: 320, marginHorizontal: espaciado.lg, borderRadius: radios.lg, overflow: 'hidden' },
  camaraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camaraMarco: {
    width: '75%',
    height: 100,
    borderWidth: 2,
    borderColor: colores.papel,
    borderRadius: radios.md,
  },
  camaraCerrar: { position: 'absolute', bottom: espaciado.md, alignSelf: 'center' },
  confirmacionFlash: {
    position: 'absolute',
    top: espaciado.sm,
    left: espaciado.sm,
    right: espaciado.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    backgroundColor: 'rgba(47,111,79,0.92)',
    borderRadius: radios.md,
    paddingVertical: espaciado.sm,
    paddingHorizontal: espaciado.md,
  },
  confirmacionFlashTexto: { color: '#fff', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  camaraPermisoContenedor: {
    margin: espaciado.lg,
    padding: espaciado.lg,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    alignItems: 'center',
  },
  camaraPermisoTexto: { color: colores.tintaSuave, fontSize: 13, textAlign: 'center' },
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