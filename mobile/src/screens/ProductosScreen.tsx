import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { listarProductos, crearProducto, actualizarProducto, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import {
  Boton,
  EncabezadoPantalla,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { Producto } from '../lib/tipos';

// El backend valida con @IsDateString(), que acepta ISO 8601 —
// "AAAA-MM-DD" alcanza. Sin librería de selector de fecha (para no
// meter una dependencia nativa nueva), validamos el formato a mano.
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Editar la fecha desde acá evita el rodeo de tocar "editar" → abrir el
// formulario completo → buscar el campo → guardar → volver — pensado
// para cuando hay que cargar la fecha de varios productos seguidos.
function ChipFechaVencimiento({
  producto,
  onActualizado,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
}) {
  const { token } = useAuth();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(producto.fechaVencimiento ?? '');
  const [guardando, setGuardando] = useState(false);

  const fechaValida = !valor || FORMATO_FECHA.test(valor);

  async function guardar() {
    if (!token || !fechaValida) return;
    setGuardando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        fechaVencimiento: valor || undefined,
        quitarFechaVencimiento: !valor,
      });
      onActualizado(actualizado);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <View style={styles.chipFechaEdicion}>
        <TextInput
          value={valor}
          onChangeText={setValor}
          placeholder="AAAA-MM-DD"
          keyboardType="number-pad"
          autoFocus
          style={styles.chipFechaInput}
          onSubmitEditing={guardar}
        />
        <Pressable onPress={guardar} disabled={guardando || !fechaValida} hitSlop={8}>
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={fechaValida ? colores.verdeGanancia : colores.papelLinea}
          />
        </Pressable>
        <Pressable onPress={() => setEditando(false)} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={colores.tintaSuave} />
        </Pressable>
      </View>
    );
  }

  const fechaLegible = producto.fechaVencimiento
    ? new Date(producto.fechaVencimiento + 'T00:00:00').toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <Pressable
      onPress={() => {
        setValor(producto.fechaVencimiento ?? '');
        setEditando(true);
      }}
      hitSlop={4}
    >
      <Text style={styles.filaVencimiento}>
        {fechaLegible ? `Vence ${fechaLegible}` : 'Poner fecha de vencimiento'}
      </Text>
    </Pressable>
  );
}

function FilaProducto({
  producto,
  onEditar,
  onActualizado,
}: {
  producto: Producto;
  onEditar: () => void;
  onActualizado: (p: Producto) => void;
}) {
  const stockBajo = producto.stock <= producto.stockMinimo && producto.stockMinimo > 0;

  return (
    <Tarjeta style={styles.filaTarjeta}>
      <View style={styles.filaIconoFondo}>
        <Ionicons name="cube-outline" size={18} color={colores.tintaSuave} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.filaNombre} numberOfLines={1}>
          {producto.nombre}
        </Text>
        <Text style={styles.filaCodigo}>{producto.codigoBarras}</Text>
        <ChipFechaVencimiento producto={producto} onActualizado={onActualizado} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.filaPrecio}>{formatearCentavos(producto.precioVentaCentavos)}</Text>
        <View style={[styles.stockPill, stockBajo && styles.stockPillBajo]}>
          <Text style={[styles.filaStock, stockBajo && styles.filaStockBajo]}>
            Stock {producto.stock}
          </Text>
        </View>
      </View>
      <Pressable onPress={onEditar} style={styles.editarBoton} hitSlop={8}>
        <Ionicons name="pencil-outline" size={16} color={colores.tintaSuave} />
      </Pressable>
    </Tarjeta>
  );
}

function FormularioNuevoProducto({
  onCreado,
  onCerrar,
}: {
  onCreado: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fechaValida = !fechaVencimiento || FORMATO_FECHA.test(fechaVencimiento);

  async function manejarSubmit() {
    if (!token || !fechaValida) return;
    setError(null);
    setEnviando(true);
    try {
      const producto = await crearProducto(token, {
        codigoBarras: codigoBarras.trim(),
        nombre: nombre.trim(),
        precioVentaCentavos: Math.round(parseFloat(precioVenta || '0') * 100),
        costoUnitarioCentavos: costoUnitario
          ? Math.round(parseFloat(costoUnitario) * 100)
          : undefined,
        stockInicial: stockInicial ? parseInt(stockInicial, 10) : undefined,
        stockMinimo: stockMinimo ? parseInt(stockMinimo, 10) : undefined,
        fechaVencimiento: fechaVencimiento || undefined,
      });
      onCreado(producto);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta style={styles.formulario}>
      <View style={styles.formularioTituloFila}>
        <Ionicons name="add-circle-outline" size={18} color={colores.tinta} />
        <Text style={styles.formularioTitulo}>Nuevo producto</Text>
      </View>

      <Etiqueta>Código de barras</Etiqueta>
      <TextInput
        value={codigoBarras}
        onChangeText={setCodigoBarras}
        style={estilosCampo.input}
        placeholder="7791234567890"
      />
      <Etiqueta>Nombre</Etiqueta>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        style={estilosCampo.input}
        placeholder="Coca Cola 500ml"
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
      <Etiqueta>Stock mínimo (opcional)</Etiqueta>
      <TextInput
        value={stockMinimo}
        onChangeText={setStockMinimo}
        keyboardType="number-pad"
        style={estilosCampo.input}
        placeholder="5"
      />
      <Etiqueta>Fecha de vencimiento (opcional)</Etiqueta>
      <TextInput
        value={fechaVencimiento}
        onChangeText={setFechaVencimiento}
        style={estilosCampo.input}
        placeholder="AAAA-MM-DD"
        keyboardType="number-pad"
      />
      {!fechaValida && (
        <Text style={styles.error}>Formato de fecha inválido, usá AAAA-MM-DD.</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!codigoBarras || !nombre || !precioVenta || !fechaValida}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </Tarjeta>
  );
}

function FormularioEditarProducto({
  producto,
  onActualizado,
  onCerrar,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const [precioVenta, setPrecioVenta] = useState((producto.precioVentaCentavos / 100).toString());
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo.toString());
  const [fechaVencimiento, setFechaVencimiento] = useState(producto.fechaVencimiento ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fechaValida = !fechaVencimiento || FORMATO_FECHA.test(fechaVencimiento);

  async function manejarSubmit() {
    if (!token || !fechaValida) return;
    setError(null);
    setEnviando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        precioVentaCentavos: Math.round(parseFloat(precioVenta || '0') * 100),
        stockMinimo: stockMinimo ? parseInt(stockMinimo, 10) : 0,
        fechaVencimiento: fechaVencimiento || undefined,
        quitarFechaVencimiento: !fechaVencimiento,
      });
      onActualizado(actualizado);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta style={styles.formulario}>
      <View style={styles.formularioTituloFila}>
        <Ionicons name="pencil-outline" size={18} color={colores.tinta} />
        <Text style={styles.formularioTitulo} numberOfLines={1}>
          Editando: {producto.nombre}
        </Text>
      </View>

      <Etiqueta>Precio de venta</Etiqueta>
      <TextInput
        value={precioVenta}
        onChangeText={setPrecioVenta}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
      />
      <Etiqueta>Stock mínimo</Etiqueta>
      <TextInput
        value={stockMinimo}
        onChangeText={setStockMinimo}
        keyboardType="number-pad"
        style={estilosCampo.input}
      />
      <Etiqueta>Fecha de vencimiento</Etiqueta>
      <TextInput
        value={fechaVencimiento}
        onChangeText={setFechaVencimiento}
        style={estilosCampo.input}
        placeholder="AAAA-MM-DD (vacío = sin vencimiento)"
        keyboardType="number-pad"
      />
      {!fechaValida && (
        <Text style={styles.error}>Formato de fecha inválido, usá AAAA-MM-DD.</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!precioVenta || !fechaValida}
          style={{ flex: 1 }}
        >
          Guardar cambios
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </Tarjeta>
  );
}

export function ProductosScreen() {
  const { token } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [productoEditandoId, setProductoEditandoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    listarProductos(token)
      .then(setProductos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo'))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={[]}>
      <EncabezadoPantalla
        eyebrow="CATÁLOGO"
        titulo="Productos"
        descripcion={productos.length > 0 ? `${productos.length} en tu catálogo` : undefined}
        accion={
          !formularioAbierto ? (
            <Boton onPress={() => setFormularioAbierto(true)} style={styles.botonNuevo}>
              + Nuevo
            </Boton>
          ) : undefined
        }
      />

      <FlatList
        data={productos}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) =>
          productoEditandoId === item.id ? (
            <FormularioEditarProducto
              producto={item}
              onActualizado={(actualizado) =>
                setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
              }
              onCerrar={() => setProductoEditandoId(null)}
            />
          ) : (
            <FilaProducto
              producto={item}
              onEditar={() => setProductoEditandoId(item.id)}
              onActualizado={(actualizado) =>
                setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
              }
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        ListHeaderComponent={
          formularioAbierto ? (
            <FormularioNuevoProducto
              onCreado={(p) => setProductos((prev) => [p, ...prev])}
              onCerrar={() => setFormularioAbierto(false)}
            />
          ) : null
        }
        ListHeaderComponentStyle={{ marginBottom: formularioAbierto ? espaciado.md : 0 }}
        ListEmptyComponent={
          !cargando && !error ? (
            <EstadoVacio
              icono="cube-outline"
              titulo="Todavía no hay productos"
              descripcion='Usá "+ Nuevo" para empezar a cargar tu catálogo.'
            />
          ) : null
        }
      />

      {cargando && <EstadoCargando texto="Cargando catálogo…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  botonNuevo: { paddingHorizontal: espaciado.lg, minHeight: 42 },
  listaContenido: { padding: espaciado.lg, paddingTop: 0, flexGrow: 1 },
  formulario: { marginHorizontal: 0 },
  formularioTituloFila: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs, marginBottom: espaciado.md },
  formularioTitulo: { fontSize: 16, fontWeight: '700', color: colores.tinta },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  filaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    paddingVertical: espaciado.md,
  },
  filaIconoFondo: {
    width: 38,
    height: 38,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaNombre: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  filaCodigo: { fontSize: 11, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  filaVencimiento: { fontSize: 11, color: colores.ambar, marginTop: 2, fontWeight: '600' },
  chipFechaEdicion: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs, marginTop: 4 },
  chipFechaInput: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.sm,
    paddingHorizontal: espaciado.sm,
    paddingVertical: 4,
    fontSize: 11,
    color: colores.tinta,
    backgroundColor: colores.blanco,
    width: 100,
  },
  editarBoton: { marginLeft: espaciado.xs, padding: 4 },
  filaPrecio: { fontSize: 14, color: colores.tinta, fontVariant: ['tabular-nums'], fontWeight: '600' },
  stockPill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radios.full },
  stockPillBajo: { backgroundColor: 'rgba(217,140,43,0.14)' },
  filaStock: { fontSize: 11, color: colores.tintaSuave },
  filaStockBajo: { color: '#a8610b', fontWeight: '700' },
});