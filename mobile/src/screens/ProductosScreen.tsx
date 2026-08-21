import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { listarProductos, crearProducto, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { Boton, EstadoCargando, EstadoError, EstadoVacio, Etiqueta, estilosCampo } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { Producto } from '../lib/tipos';

function FilaProducto({ producto }: { producto: Producto }) {
  const stockBajo = producto.stock <= producto.stockMinimo && producto.stockMinimo > 0;
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1 }}>
        <Text style={styles.filaNombre}>{producto.nombre}</Text>
        <Text style={styles.filaCodigo}>{producto.codigoBarras}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.filaPrecio}>{formatearCentavos(producto.precioVentaCentavos)}</Text>
        <Text style={[styles.filaStock, stockBajo && styles.filaStockBajo]}>
          Stock {producto.stock}
        </Text>
      </View>
    </View>
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
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit() {
    if (!token) return;
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
    <View style={styles.formulario}>
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

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!codigoBarras || !nombre || !precioVenta}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </View>
  );
}

export function ProductosScreen() {
  const { token } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

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
    <SafeAreaView style={styles.contenedor} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CATÁLOGO</Text>
          <Text style={styles.titulo}>Productos</Text>
        </View>
        {!formularioAbierto && (
          <Boton onPress={() => setFormularioAbierto(true)} style={{ paddingHorizontal: espaciado.lg }}>
            + Nuevo
          </Boton>
        )}
      </View>

      {formularioAbierto && (
        <FormularioNuevoProducto
          onCreado={(p) => setProductos((prev) => [p, ...prev])}
          onCerrar={() => setFormularioAbierto(false)}
        />
      )}

      {cargando && <EstadoCargando texto="Cargando catálogo…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

      {!cargando && !error && productos.length === 0 && (
        <EstadoVacio
          titulo="Todavía no hay productos"
          descripcion='Usá "+ Nuevo" para empezar a cargar tu catálogo.'
        />
      )}

      {!cargando && !error && productos.length > 0 && (
        <FlatList
          data={productos}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <FilaProducto producto={item} />}
          contentContainerStyle={{ padding: espaciado.lg }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: espaciado.lg,
    paddingTop: espaciado.md,
    paddingBottom: espaciado.sm,
    gap: espaciado.md,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: colores.ambar, marginBottom: espaciado.xs },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.tinta },
  formulario: {
    margin: espaciado.lg,
    padding: espaciado.lg,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: espaciado.md,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  filaNombre: { fontSize: 14, color: colores.tinta, fontWeight: '500' },
  filaCodigo: { fontSize: 11, color: colores.tintaSuave, marginTop: 2 },
  filaPrecio: { fontSize: 14, color: colores.tinta, fontVariant: ['tabular-nums'] },
  filaStock: { fontSize: 11, color: colores.tintaSuave, marginTop: 2 },
  filaStockBajo: { color: colores.ambar, fontWeight: '600' },
});
