import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { formatearCentavos, formatearFechaCorta } from '../lib/formato';
import {
  BarraProporcional,
  Boton,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
  TarjetaMetrica,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import { SelectorProducto } from '../components/selector-producto';
import { Banda, Hoja, Mosaico, Pieza } from '../components/banda';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type AlertasProductos,
  type MotivoMerma,
  type Producto,
  type ResumenMovimientosDelDia,
} from '../lib/tipos';

const MOTIVOS: MotivoMerma[] = ['vencido', 'danado', 'robado', 'otro'];

function FormularioAbastecimiento({
  productos,
  onRegistrado,
  productoInicialId = '',
}: {
  productos: Producto[];
  onRegistrado: () => void;
  productoInicialId?: string;
}) {
  const { token } = useAuth();
  const [productoId, setProductoId] = useState(productoInicialId);
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
        placeholder="Ej: 50"
      />

      <Etiqueta>Costo unitario</Etiqueta>
      <TextInput
        value={costoUnitario}
        onChangeText={setCostoUnitario}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="Ej: 0.90"
      />

      <Etiqueta>Proveedor (opcional)</Etiqueta>
      <TextInput
        value={proveedor}
        onChangeText={setProveedor}
        style={estilosCampo.input}
        placeholder="Ej: Distribuidora Central"
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
        placeholder="Ej: 3"
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

function SeccionAlertas({
  alertas,
  onAbastecer,
}: {
  alertas: AlertasProductos | null;
  onAbastecer?: (productoId: string) => void;
}) {
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
              <View style={styles.alertaDerecha}>
                <Text style={[styles.alertaValor, { color: colores.ambar }]}>
                  {p.stock} / mín. {p.stockMinimo}
                </Text>
                {onAbastecer && (
                  <Pressable onPress={() => onAbastecer(p.id)} hitSlop={8}>
                    <Text style={styles.alertaAccion}>Abastecer</Text>
                  </Pressable>
                )}
              </View>
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
                  ? formatearFechaCorta(p.fechaVencimiento)
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
  // Producto elegido desde "Abastecer" en una alerta. `vez` fuerza a
  // rearmar el formulario aunque se toque dos veces el mismo producto.
  const [sugerido, setSugerido] = useState<{ id: string; vez: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formularioYRef = useRef(0);

  function abastecerDesdeAlerta(productoId: string) {
    setSugerido({ id: productoId, vez: Date.now() });
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: formularioYRef.current, animated: true }),
    );
  }

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
    <SafeAreaView style={styles.contenedor} edges={[]}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }}>
        <Banda
          eyebrow="Control de stock"
          titulo="Inventario"
          valor={resumen ? formatearCentavos(resumen.egresoCentavos) : undefined}
          detalle={
            resumen
              ? `Gastado hoy en abastecimiento · ${formatearCentavos(resumen.perdidaCentavos)} perdidos por merma`
              : undefined
          }
        />
        <Hoja style={{ paddingHorizontal: espaciado.lg, paddingBottom: espaciado.xxl, gap: espaciado.lg }}>
        {cargando && <EstadoCargando texto="Cargando inventario…" />}
        {error && !cargando && <EstadoError mensaje={error} onReintentar={cargarTodo} />}

        {!cargando && !error && resumen && (
          <>
            <View style={{ flexDirection: 'row', gap: espaciado.md }}>
              <TarjetaMetrica
                etiqueta="Gastado hoy"
                valor={formatearCentavos(resumen.egresoCentavos)}
                detalle={`${resumen.cantidadAbastecimientos} mov.`}
                icono="arrow-down-circle-outline"
              />
              <TarjetaMetrica
                etiqueta="Pérdida hoy"
                valor={formatearCentavos(resumen.perdidaCentavos)}
                detalle={`${resumen.cantidadMermas} mov.`}
                icono="trash-outline"
                tono="danger"
              />
            </View>

            {(resumen.egresoCentavos > 0 || resumen.perdidaCentavos > 0) && (
              <Tarjeta>
                <Text style={styles.balanceTitulo}>Balance del día</Text>
                <View style={{ marginTop: espaciado.sm }}>
                  <BarraProporcional
                    etiquetaA="Abastecimiento"
                    valorA={resumen.egresoCentavos}
                    colorA={colores.tinta}
                    etiquetaB="Merma"
                    valorB={resumen.perdidaCentavos}
                    colorB={colores.rojoPerdida}
                  />
                </View>
              </Tarjeta>
            )}
          </>
        )}

        {!cargando && !error && esAdmin && productos.length === 0 && (
          <EstadoVacio
            titulo="Todavía no hay productos"
            descripcion="Agregá alguno en Productos antes de registrar movimientos."
          />
        )}

        {/* Las alertas van antes que los formularios: es lo que más se
            consulta, y quedaban al fondo de la pantalla. */}
        {!cargando && !error && (
          <View>
            <Text style={styles.seccionTitulo}>Alertas</Text>
            <SeccionAlertas
              alertas={alertas}
              onAbastecer={esAdmin ? abastecerDesdeAlerta : undefined}
            />
          </View>
        )}

        {!cargando && !error && esAdmin && productos.length > 0 && (
          <>
            <View onLayout={(e) => (formularioYRef.current = e.nativeEvent.layout.y)}>
              <FormularioAbastecimiento
                key={sugerido?.vez ?? 'inicial'}
                productos={productos}
                onRegistrado={cargarTodo}
                productoInicialId={sugerido?.id}
              />
            </View>
            <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
          </>
        )}
        </Hoja>
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
  balanceTitulo: { fontSize: 13, fontWeight: '700', color: colores.tinta },
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
  alertaDerecha: { flexDirection: 'row', alignItems: 'center', gap: espaciado.md },
  alertaAccion: { fontSize: 13, fontWeight: '600', color: colores.tinta, textDecorationLine: 'underline' },
  alertaNombre: { flex: 1, fontSize: 13, color: colores.tinta, marginRight: espaciado.sm },
  alertaValor: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});