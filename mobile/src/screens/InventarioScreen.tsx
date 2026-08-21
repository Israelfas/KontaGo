import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import {
  listarProductos,
  obtenerResumenInventarioDelDia,
  obtenerAlertas,
  registrarAbastecimiento,
  registrarMerma,
  ApiError,
} from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import {
  Boton,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  TarjetaMetrica,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type AlertasProductos,
  type MotivoMerma,
  type Producto,
  type ResumenMovimientosDelDia,
} from '../lib/tipos';

const MOTIVOS: MotivoMerma[] = ['vencido', 'danado', 'robado', 'otro'];

// Selector de producto simple: RN no tiene <select> nativo, así que se
// arma con botones apilados. Alcanza para catálogos chicos/medianos; si
// el catálogo crece mucho conviene cambiar esto por un modal con buscador.
function SelectorProducto({
  productos,
  seleccionadoId,
  onSeleccionar,
}: {
  productos: Producto[];
  seleccionadoId: string;
  onSeleccionar: (id: string) => void;
}) {
  return (
    <View style={styles.selectorContenedor}>
      {productos.map((p) => {
        const activo = p.id === seleccionadoId;
        return (
          <Boton
            key={p.id}
            variante={activo ? 'primary' : 'secondary'}
            onPress={() => onSeleccionar(p.id)}
            style={styles.selectorItem}
          >
            {`${p.nombre} · stock ${p.stock}`}
          </Boton>
        );
      })}
    </View>
  );
}

function FormularioAbastecimiento({
  productos,
  onRegistrado,
}: {
  productos: Producto[];
  onRegistrado: () => void;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await registrarAbastecimiento(token, {
        productoId,
        cantidad: parseInt(cantidad, 10),
        costoUnitarioCentavos: Math.round(parseFloat(costoUnitario) * 100),
        proveedor: proveedor || undefined,
      });
      setProductoId('');
      setCantidad('');
      setCostoUnitario('');
      setProveedor('');
      onRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abastecimiento');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>Abastecimiento</Text>
      <Text style={styles.formularioSubtitulo}>
        Suma stock y recalcula el costo promedio del producto.
      </Text>

      <Etiqueta>Producto</Etiqueta>
      <SelectorProducto productos={productos} seleccionadoId={productoId} onSeleccionar={setProductoId} />

      <Etiqueta>Cantidad</Etiqueta>
      <TextInput
        value={cantidad}
        onChangeText={setCantidad}
        keyboardType="number-pad"
        style={estilosCampo.input}
        placeholder="50"
      />

      <Etiqueta>Costo unitario</Etiqueta>
      <TextInput
        value={costoUnitario}
        onChangeText={setCostoUnitario}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="0.90"
      />

      <Etiqueta>Proveedor (opcional)</Etiqueta>
      <TextInput
        value={proveedor}
        onChangeText={setProveedor}
        style={estilosCampo.input}
        placeholder="Distribuidora Central"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Boton onPress={manejarSubmit} cargando={enviando} disabled={!productoId || !cantidad || !costoUnitario}>
        Registrar abastecimiento
      </Boton>
    </View>
  );
}

function FormularioMerma({
  productos,
  onRegistrado,
}: {
  productos: Producto[];
  onRegistrado: () => void;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState<MotivoMerma>('vencido');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await registrarMerma(token, { productoId, cantidad: parseInt(cantidad, 10), motivo });
      setProductoId('');
      setCantidad('');
      setMotivo('vencido');
      onRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.formulario}>
      <Text style={styles.formularioTitulo}>Merma</Text>
      <Text style={styles.formularioSubtitulo}>
        Descuenta stock y valoriza la pérdida a costo, no a precio de venta.
      </Text>

      <Etiqueta>Producto</Etiqueta>
      <SelectorProducto productos={productos} seleccionadoId={productoId} onSeleccionar={setProductoId} />

      <Etiqueta>Cantidad</Etiqueta>
      <TextInput
        value={cantidad}
        onChangeText={setCantidad}
        keyboardType="number-pad"
        style={estilosCampo.input}
        placeholder="3"
      />

      <Etiqueta>Motivo</Etiqueta>
      <View style={styles.selectorContenedor}>
        {MOTIVOS.map((m) => (
          <Boton
            key={m}
            variante={motivo === m ? 'danger' : 'secondary'}
            onPress={() => setMotivo(m)}
            style={styles.selectorItem}
          >
            {ETIQUETAS_MOTIVO_MERMA[m]}
          </Boton>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Boton variante="danger" onPress={manejarSubmit} cargando={enviando} disabled={!productoId || !cantidad}>
        Registrar merma
      </Boton>
    </View>
  );
}

function SeccionAlertas({ alertas }: { alertas: AlertasProductos | null }) {
  if (!alertas) return null;
  const sinAlertas = alertas.stockBajo.length === 0 && alertas.porVencer.length === 0;

  if (sinAlertas) {
    return <EstadoVacio titulo="Todo en orden" descripcion="No hay alertas de stock bajo ni de vencimiento." />;
  }

  return (
    <View style={{ gap: espaciado.md }}>
      {alertas.stockBajo.length > 0 && (
        <View style={styles.alertaBloque}>
          <Text style={[styles.alertaTitulo, { color: colores.ambar }]}>Stock bajo</Text>
          {alertas.stockBajo.map((p) => (
            <View key={p.id} style={styles.alertaFila}>
              <Text style={styles.alertaNombre}>{p.nombre}</Text>
              <Text style={[styles.alertaValor, { color: colores.ambar }]}>
                {p.stock} / mín. {p.stockMinimo}
              </Text>
            </View>
          ))}
        </View>
      )}
      {alertas.porVencer.length > 0 && (
        <View style={styles.alertaBloque}>
          <Text style={[styles.alertaTitulo, { color: colores.rojoPerdida }]}>Por vencer</Text>
          {alertas.porVencer.map((p) => (
            <View key={p.id} style={styles.alertaFila}>
              <Text style={styles.alertaNombre}>{p.nombre}</Text>
              <Text style={[styles.alertaValor, { color: colores.rojoPerdida }]}>
                {p.fechaVencimiento
                  ? new Date(p.fechaVencimiento).toLocaleDateString('es', { day: 'numeric', month: 'short' })
                  : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function InventarioScreen() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [productos, setProductos] = useState<Producto[]>([]);
  const [resumen, setResumen] = useState<ResumenMovimientosDelDia | null>(null);
  const [alertas, setAlertas] = useState<AlertasProductos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarTodo = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    setError(null);
    try {
      const [productosResp, resumenResp, alertasResp] = await Promise.all([
        listarProductos(token),
        obtenerResumenInventarioDelDia(token),
        obtenerAlertas(token),
      ]);
      setProductos(productosResp);
      setResumen(resumenResp);
      setAlertas(alertasResp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el inventario');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargarTodo();
    }, [cargarTodo]),
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTROL DE STOCK</Text>
        <Text style={styles.titulo}>Inventario</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: espaciado.lg, gap: espaciado.lg }}>
        {cargando && <EstadoCargando texto="Cargando inventario…" />}
        {error && !cargando && <EstadoError mensaje={error} onReintentar={cargarTodo} />}

        {!cargando && !error && resumen && (
          <View style={{ flexDirection: 'row', gap: espaciado.md }}>
            <TarjetaMetrica
              etiqueta="Gastado hoy"
              valor={formatearCentavos(resumen.egresoCentavos)}
              detalle={`${resumen.cantidadAbastecimientos} mov.`}
            />
            <TarjetaMetrica
              etiqueta="Pérdida hoy"
              valor={formatearCentavos(resumen.perdidaCentavos)}
              detalle={`${resumen.cantidadMermas} mov.`}
              tono="danger"
            />
          </View>
        )}

        {!cargando && !error && esAdmin && productos.length === 0 && (
          <EstadoVacio
            titulo="Todavía no hay productos"
            descripcion="Agregá alguno en Productos antes de registrar movimientos."
          />
        )}

        {!cargando && !error && esAdmin && productos.length > 0 && (
          <>
            <FormularioAbastecimiento productos={productos} onRegistrado={cargarTodo} />
            <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
          </>
        )}

        {!cargando && !error && (
          <View>
            <Text style={styles.seccionTitulo}>Alertas</Text>
            <SeccionAlertas alertas={alertas} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  header: { paddingHorizontal: espaciado.lg, paddingTop: espaciado.md, paddingBottom: espaciado.sm },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: colores.ambar, marginBottom: espaciado.xs },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.tinta },
  formulario: {
    padding: espaciado.lg,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  formularioTitulo: { fontSize: 16, fontWeight: '700', color: colores.tinta },
  formularioSubtitulo: { fontSize: 12, color: colores.tintaSuave, marginBottom: espaciado.md },
  selectorContenedor: { gap: espaciado.xs, marginBottom: espaciado.md },
  selectorItem: { minHeight: 40, paddingVertical: espaciado.sm },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  seccionTitulo: { fontSize: 16, fontWeight: '700', color: colores.tinta, marginBottom: espaciado.sm },
  alertaBloque: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    overflow: 'hidden',
  },
  alertaTitulo: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: espaciado.md,
    paddingBottom: espaciado.xs,
  },
  alertaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
  },
  alertaNombre: { fontSize: 13, color: colores.tinta },
  alertaValor: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
