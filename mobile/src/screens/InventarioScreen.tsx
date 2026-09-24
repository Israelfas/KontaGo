import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../lib/auth-context';
import {
  corregirLotes,
  listarProductos,
  obtenerResumenInventarioDelDia,
  obtenerAlertas,
  registrarAbastecimiento,
  registrarMerma,
  ApiError,
  type FilaDeLote,
} from '../lib/api';
import {
  esFechaValida,
  escribirFecha,
  formatearCentavos,
  formatearFechaCorta,
} from '../lib/formato';
import {
  lotesPorVencer,
  lotesVencidos,
  resumenDeLotes,
  textoVencimiento,
  unidades,
} from '../lib/lotes';
import { aCentavos, avisoDelMargen, avisoDelVencimiento } from '../lib/validacion';
import {
  AvisoDeCampo,
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
import { HojaModal, HojaPie, useHoja } from '../components/hoja-modal';
import { vibrar } from '../components/movimiento';
import { SelectorProducto } from '../components/selector-producto';
import { Banda, Hoja, Mosaico, Pieza } from '../components/banda';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type AlertasProductos,
  type Lote,
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
  const { cerrar } = useHoja();
  const [productoId, setProductoId] = useState(productoInicialId);
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const elegido = productos.find((p) => p.id === productoId);
  const fechaValida = !fechaVencimiento || esFechaValida(fechaVencimiento);
  // Contra el precio al que se vende hoy: un costo mayor casi siempre es
  // un precio mal tipeado (o hay que subir el de venta).
  const avisoCosto = elegido
    ? avisoDelMargen(elegido.precioVentaCentavos, aCentavos(costoUnitario))
    : null;

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
        fechaVencimiento: fechaVencimiento || undefined,
      });
      vibrar.exito();
      onRegistrado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abastecimiento');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
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
      <AvisoDeCampo
        advertencia={
          avisoCosto && elegido
            ? `Hoy lo vendes a ${formatearCentavos(elegido.precioVentaCentavos)}. ${avisoCosto}`
            : null
        }
      />

      <Etiqueta>Proveedor (opcional)</Etiqueta>
      <TextInput
        value={proveedor}
        onChangeText={setProveedor}
        style={estilosCampo.input}
        placeholder="Ej: Distribuidora Central"
      />

      <Etiqueta>Vence el (opcional)</Etiqueta>
      <TextInput
        value={fechaVencimiento}
        onChangeText={(t) => setFechaVencimiento(escribirFecha(t))}
        keyboardType="number-pad"
        style={estilosCampo.input}
        placeholder="AAAA-MM-DD"
        maxLength={10}
      />
      <AvisoDeCampo
        error={!fechaValida && fechaVencimiento.length === 10 ? 'Esa fecha no existe.' : null}
        advertencia={fechaValida ? avisoDelVencimiento(fechaVencimiento) : null}
      />
      {/* Lo que ya hay: si la mercadería nueva trae otra fecha, no se mezcla. */}
      <Text style={styles.ayuda}>
        {elegido?.lotes && elegido.lotes.length > 0
          ? `Hoy hay ${resumenDeLotes(elegido)}. Si esta mercadería trae otra fecha, queda como un lote aparte.`
          : 'Déjalo vacío si el producto no vence.'}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <HojaPie>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!productoId || !cantidad || !costoUnitario || !fechaValida}
          style={{ flex: 1 }}
        >
          Registrar
        </Boton>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
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
  const { cerrar } = useHoja();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState<MotivoMerma>('vencido');
  // '' = del que vence antes (lo mismo que hace una venta).
  const [loteId, setLoteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const producto = productos.find((p) => p.id === productoId);
  const lotes = producto?.lotes ?? [];
  const loteElegido = lotes.find((l) => l.id === loteId);
  // No se puede dar de baja más de lo que hay (el backend lo rechaza).
  const disponible = loteElegido?.cantidad ?? producto?.stock;
  const problemaCantidad =
    disponible !== undefined && parseInt(cantidad, 10) > disponible
      ? `Solo hay ${unidades(disponible)}${loteElegido ? ' en ese lote' : ''}.`
      : null;

  async function manejarSubmit() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await registrarMerma(token, {
        productoId,
        cantidad: parseInt(cantidad, 10),
        motivo,
        loteId: loteId || undefined,
      });
      vibrar.exito();
      onRegistrado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
      <Etiqueta>Producto</Etiqueta>
      <SelectorProducto
        productos={productos}
        seleccionadoId={productoId}
        onSeleccionar={(id) => {
          setProductoId(id);
          setLoteId('');
        }}
      />

      {lotes.length > 1 && (
        <>
          <Etiqueta>De qué lote</Etiqueta>
          <View style={styles.selectorContenedor}>
            <Boton
              variante={loteId === '' ? 'primary' : 'secondary'}
              onPress={() => setLoteId('')}
              style={styles.selectorItem}
            >
              El que vence antes
            </Boton>
            {lotes.map((l) => (
              <Boton
                key={l.id}
                variante={loteId === l.id ? 'primary' : 'secondary'}
                onPress={() => setLoteId(l.id)}
                style={styles.selectorItem}
              >
                {`${unidades(l.cantidad)} · ${textoVencimiento(l)}`}
              </Boton>
            ))}
          </View>
        </>
      )}

      <Etiqueta>Cantidad</Etiqueta>
      <TextInput
        value={cantidad}
        onChangeText={setCantidad}
        keyboardType="number-pad"
        style={[estilosCampo.input, problemaCantidad && estilosCampo.inputInvalido]}
        placeholder="Ej: 3"
      />
      <AvisoDeCampo error={problemaCantidad} />

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

      <HojaPie>
        <Boton
          variante="danger"
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!productoId || !cantidad || !!problemaCantidad}
          style={{ flex: 1 }}
        >
          Registrar merma
        </Boton>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
    </View>
  );
}

function SeccionAlertas({
  alertas,
  onAbastecer,
  onDarDeBaja,
}: {
  alertas: AlertasProductos | null;
  onAbastecer?: (productoId: string) => void;
  onDarDeBaja?: (producto: Producto, lote: Lote) => void;
}) {
  if (!alertas) return null;
  const sinAlertas =
    alertas.stockBajo.length === 0 &&
    alertas.porVencer.length === 0 &&
    alertas.vencidos.length === 0;

  if (sinAlertas) {
    return <EstadoVacio titulo="Todo en orden" descripcion="No hay alertas de stock bajo ni de vencimiento." />;
  }

  // Una fila por lote: de 18 leches pueden vencer 6 y las otras 12 no.
  const porVencer = alertas.porVencer.flatMap((p) => lotesPorVencer(p).map((lote) => ({ p, lote })));
  const vencidos = alertas.vencidos.flatMap((p) => lotesVencidos(p).map((lote) => ({ p, lote })));

  return (
    <View style={{ gap: espaciado.md }}>
      {vencidos.length > 0 && (
        <View style={styles.alertaBloque}>
          <Text style={[styles.alertaTitulo, { color: colores.rojoPerdida }]}>Vencidos en el estante</Text>
          {vencidos.map(({ p, lote }) => (
            <View key={lote.id} style={styles.alertaFila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertaNombre}>{p.nombre}</Text>
                <Text style={[styles.alertaDetalle, { color: colores.rojoPerdida }]}>
                  {unidades(lote.cantidad)} · {textoVencimiento(lote)}
                </Text>
              </View>
              {onDarDeBaja && (
                <Pressable onPress={() => onDarDeBaja(p, lote)} hitSlop={8}>
                  <Text style={styles.alertaAccion}>Dar de baja</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
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
      {porVencer.length > 0 && (
        <View style={styles.alertaBloque}>
          <Text style={[styles.alertaTitulo, { color: colores.rojoPerdida }]}>Por vencer</Text>
          {porVencer.map(({ p, lote }) => (
            <View key={lote.id} style={styles.alertaFila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertaNombre}>{p.nombre}</Text>
                {/* Con varias fechas, cuántas son las que vencen. */}
                {p.stock !== lote.cantidad && (
                  <Text style={styles.alertaDetalle}>
                    {unidades(lote.cantidad)} de {p.stock}
                  </Text>
                )}
              </View>
              <Text style={[styles.alertaValor, { color: colores.rojoPerdida }]}>
                {formatearFechaCorta(lote.fechaVencimiento!)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Lotes: cómo está repartido el stock entre fechas ---

interface FilaEditable {
  clave: string;
  id?: string;
  fecha: string; // lo que se tipea ('' = sin fecha)
  cantidad: string;
}

/**
 * Corrección después de revisar la góndola ("hay 8 del 28 y 4 del 5, no
 * 6 y 6"). El total no cambia: si falta o sobra mercadería, es una merma
 * o un abastecimiento.
 */
function EditorLotes({
  producto,
  onGuardado,
}: {
  producto: Producto;
  onGuardado: () => void;
}) {
  const { cerrar } = useHoja();
  const { token } = useAuth();
  const [filas, setFilas] = useState<FilaEditable[]>(() =>
    (producto.lotes ?? []).map((l) => ({
      clave: l.id,
      id: l.id,
      fecha: l.fechaVencimiento ?? '',
      cantidad: String(l.cantidad),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const suma = filas.reduce((acc, f) => acc + (parseInt(f.cantidad, 10) || 0), 0);
  const diferencia = suma - producto.stock;
  const fechasValidas = filas.every((f) => !f.fecha || esFechaValida(f.fecha));

  function cambiar(clave: string, cambios: Partial<FilaEditable>) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  async function guardar() {
    if (!token || diferencia !== 0 || !fechasValidas) return;
    setEnviando(true);
    setError(null);
    try {
      const lotes: FilaDeLote[] = filas.map((f) => ({
        id: f.id,
        fechaVencimiento: f.fecha || null,
        cantidad: parseInt(f.cantidad, 10) || 0,
      }));
      await corregirLotes(token, producto.id, lotes);
      onGuardado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los lotes');
      setEnviando(false);
    }
  }

  return (
    <View style={styles.editor}>
      {filas.map((fila) => (
        <View key={fila.clave} style={styles.editorFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.editorEtiqueta}>Vence el</Text>
            <TextInput
              value={fila.fecha}
              onChangeText={(t) => cambiar(fila.clave, { fecha: escribirFecha(t) })}
              keyboardType="number-pad"
              style={[estilosCampo.input, styles.editorInput]}
              placeholder="Sin fecha"
              maxLength={10}
              accessibilityLabel="Fecha de vencimiento"
            />
          </View>
          <View style={{ width: 84 }}>
            <Text style={styles.editorEtiqueta}>Unidades</Text>
            <TextInput
              value={fila.cantidad}
              onChangeText={(t) => cambiar(fila.clave, { cantidad: t.replace(/\D/g, '') })}
              keyboardType="number-pad"
              style={[estilosCampo.input, styles.editorInput]}
              accessibilityLabel="Unidades"
            />
          </View>
        </View>
      ))}

      <Pressable
        onPress={() =>
          setFilas((prev) => [...prev, { clave: `nueva-${Date.now()}`, fecha: '', cantidad: '0' }])
        }
        hitSlop={8}
      >
        <Text style={styles.alertaAccion}>+ Agregar otra fecha</Text>
      </Pressable>

      <Text style={[styles.ayuda, diferencia !== 0 && { color: colores.rojoPerdida, fontWeight: '600' }]}>
        Suman {suma} de {producto.stock} en stock
        {diferencia > 0 ? ` · sobran ${diferencia}` : ''}
        {diferencia < 0 ? ` · faltan ${-diferencia}` : ''}.
        {diferencia !== 0
          ? ' Si en el estante hay otra cantidad, registra la diferencia como merma o abastecimiento.'
          : ''}
      </Text>
      {!fechasValidas && <Text style={styles.error}>Hay una fecha que no existe.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <HojaPie>
        <Boton
          onPress={guardar}
          cargando={enviando}
          disabled={diferencia !== 0 || !fechasValidas}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
    </View>
  );
}

function SeccionLotes({ productos, onCambio }: { productos: Producto[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<Producto | null>(null);
  const conLotes = productos.filter((p) => (p.lotes?.length ?? 0) > 0);

  return (
    <View>
      <Text style={styles.seccionTitulo}>Lotes</Text>
      <Text style={[styles.ayuda, { marginBottom: espaciado.sm }]}>
        Cuántas unidades vencen en cada fecha. Las ventas y las mermas descuentan primero lo que
        vence antes.
      </Text>
      {conLotes.length === 0 ? (
        <Text style={styles.ayuda}>
          Todavía ningún producto tiene fecha de vencimiento. Se carga al abastecer.
        </Text>
      ) : (
        <View style={{ gap: espaciado.sm }}>
          {conLotes.map((p) => {
            const vencidos = lotesVencidos(p);
            const pronto = lotesPorVencer(p);
            return (
              <View key={p.id} style={styles.loteTarjeta}>
                <View style={styles.loteCabecera}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loteNombre}>{p.nombre}</Text>
                    <Text style={styles.alertaDetalle}>{unidades(p.stock)} en stock</Text>
                  </View>
                  <Pressable
                    onPress={() => setEditando(p)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.pildoraAccion, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="pencil-outline" size={12} color={colores.tinta} />
                    <Text style={styles.pildoraAccionTexto}>Corregir</Text>
                  </Pressable>
                </View>
                <View style={styles.lotePildoras}>
                  {p.lotes!.map((l) => {
                    const tono = vencidos.includes(l)
                      ? styles.pildoraRoja
                      : pronto.includes(l)
                        ? styles.pildoraAmbar
                        : null;
                    return (
                      <Text key={l.id} style={[styles.pildora, tono]}>
                        {unidades(l.cantidad)} · {textoVencimiento(l)}
                      </Text>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {editando && (
        <HojaModal
          titulo={`Lotes de ${editando.nombre}`}
          descripcion={`Cuántas de las ${unidades(editando.stock)} vencen en cada fecha, según la góndola.`}
          icono="pencil-outline"
          onCerrar={() => setEditando(null)}
        >
          <EditorLotes producto={editando} onGuardado={onCambio} />
        </HojaModal>
      )}
    </View>
  );
}

/** Botón grande de acción: ícono, qué hace y para qué. */
function AccionGrande({
  icono,
  tono,
  titulo,
  detalle,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  tono: 'verde' | 'rojo';
  titulo: string;
  detalle: string;
  onPress: () => void;
}) {
  const color = tono === 'verde' ? colores.verdeGanancia : colores.rojoPerdida;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.accionGrande, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}
    >
      <View
        style={[
          styles.accionIcono,
          { backgroundColor: tono === 'verde' ? 'rgba(47,111,79,0.12)' : 'rgba(182,70,47,0.1)' },
        ]}
      >
        <Ionicons name={icono} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.accionTitulo}>{titulo}</Text>
        <Text style={styles.accionDetalle}>{detalle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colores.tintaSuave} />
    </Pressable>
  );
}

export function InventarioScreen() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [resumen, setResumen] = useState<ResumenMovimientosDelDia | null>(null);
  const [alertas, setAlertas] = useState<AlertasProductos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Qué hoja está abierta. Abastecer desde una alerta la abre con el
  // producto ya elegido.
  const [abasteciendo, setAbasteciendo] = useState<{ productoId?: string } | null>(null);
  const [registrandoMerma, setRegistrandoMerma] = useState(false);

  function darDeBaja(producto: Producto, lote: Lote) {
    Alert.alert(
      'Dar de baja lo vencido',
      `${unidades(lote.cantidad)} de ${producto.nombre} (${textoVencimiento(lote)}) salen del stock como pérdida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await registrarMerma(token, {
                productoId: producto.id,
                cantidad: lote.cantidad,
                motivo: 'vencido',
                loteId: lote.id,
              });
              cargarTodo();
            } catch (err) {
              Alert.alert('No se pudo dar de baja', err instanceof ApiError ? err.message : '');
            }
          },
        },
      ],
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Banda
          eyebrow="Control de stock"
          titulo="Inventario"
          valor={resumen ? formatearCentavos(resumen.egresoCentavos) : undefined}
          detalle={
            resumen
              ? `Gastado hoy en abastecimiento · ${formatearCentavos(resumen.perdidaCentavos)} perdidos por merma`
              : undefined
          }
          accion={
            <Pressable
              onPress={() => navigation.navigate('HistorialInventario')}
              style={styles.botonHistorial}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Ionicons name="receipt-outline" size={16} color={colores.tinta} />
              <Text style={styles.botonHistorialTexto}>Historial</Text>
            </Pressable>
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
            descripcion="Agrega alguno en Productos antes de registrar movimientos."
          />
        )}

        {/* Las dos cosas que se hacen a diario, a un toque: cada una abre su
            hoja en vez de ocupar media pantalla todo el tiempo. */}
        {!cargando && !error && esAdmin && productos.length > 0 && (
          <View style={{ gap: espaciado.sm }}>
            <AccionGrande
              icono="add"
              tono="verde"
              titulo="Registrar abastecimiento"
              detalle="Llegó mercadería: suma stock y actualiza el costo."
              onPress={() => setAbasteciendo({})}
            />
            <AccionGrande
              icono="remove"
              tono="rojo"
              titulo="Registrar merma"
              detalle="Se venció, se rompió o se perdió: sale del stock."
              onPress={() => setRegistrandoMerma(true)}
            />
          </View>
        )}

        {/* Las alertas van antes que los lotes: es lo que más se consulta. */}
        {!cargando && !error && (
          <View>
            <Text style={styles.seccionTitulo}>Alertas</Text>
            <SeccionAlertas
              alertas={alertas}
              onAbastecer={esAdmin ? (productoId) => setAbasteciendo({ productoId }) : undefined}
              onDarDeBaja={esAdmin ? darDeBaja : undefined}
            />
          </View>
        )}

        {!cargando && !error && esAdmin && productos.length > 0 && (
          <>
            <SeccionLotes productos={productos} onCambio={cargarTodo} />
          </>
        )}
        </Hoja>
      </ScrollView>
      {abasteciendo && (
        <HojaModal
          titulo="Abastecimiento"
          descripcion="Suma stock y recalcula el costo promedio del producto."
          icono="add"
          tono="verde"
          onCerrar={() => setAbasteciendo(null)}
        >
          <FormularioAbastecimiento
            productos={productos}
            onRegistrado={cargarTodo}
            productoInicialId={abasteciendo.productoId}
          />
        </HojaModal>
      )}
      {registrandoMerma && (
        <HojaModal
          titulo="Merma"
          descripcion="Descuenta stock y valoriza la pérdida a costo, no a precio de venta."
          icono="remove"
          tono="rojo"
          onCerrar={() => setRegistrandoMerma(false)}
        >
          <FormularioMerma productos={productos} onRegistrado={cargarTodo} />
        </HojaModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  accionGrande: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.md,
    padding: espaciado.md,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  accionIcono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accionTitulo: { fontSize: 15, fontWeight: '800', color: colores.tinta },
  accionDetalle: { marginTop: 2, fontSize: 12, color: colores.tintaSuave },
  pildoraAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radios.full,
    backgroundColor: 'rgba(28,43,58,0.06)',
  },
  pildoraAccionTexto: { fontSize: 12, fontWeight: '700', color: colores.tinta },
  botonHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.xs,
    borderRadius: radios.full,
    backgroundColor: colores.papel,
  },
  botonHistorialTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
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
  alertaDetalle: { fontSize: 12, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  ayuda: { fontSize: 12, color: colores.tintaSuave, lineHeight: 17, marginBottom: espaciado.md },
  loteTarjeta: {
    padding: espaciado.md,
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  loteCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
  loteNombre: { fontSize: 14, fontWeight: '600', color: colores.tinta },
  lotePildoras: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espaciado.sm },
  pildora: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.tintaSuave,
    backgroundColor: colores.papel,
    borderRadius: radios.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  pildoraAmbar: { color: '#9a5b08', backgroundColor: 'rgba(217,140,43,0.14)' },
  pildoraRoja: { color: colores.rojoPerdida, backgroundColor: 'rgba(182,70,47,0.1)' },
  editor: { marginTop: espaciado.sm, gap: espaciado.sm },
  editorFila: { flexDirection: 'row', gap: espaciado.sm },
  editorEtiqueta: { fontSize: 11, fontWeight: '700', color: colores.tintaSuave, marginBottom: 2 },
  editorInput: { marginBottom: 0 },
});