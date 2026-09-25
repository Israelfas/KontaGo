import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { listarMovimientosInventario, obtenerResumenInventario, ApiError } from '../lib/api';
import { formatearCentavos, formatearFechaCorta } from '../lib/formato';
import {
  esHoy,
  fechaISO,
  fechaLarga,
  hoyISO,
  nombreDelPeriodo,
  periodoDeHoy,
  rangoLegible,
  type Periodo,
} from '../lib/periodo';
import { SelectorPeriodo } from '../components/selector-periodo';
import { BarraQueCrece } from '../components/movimiento';
import { Banda, LabioHoja, Mosaico, Pieza } from '../components/banda';
import { EstadoCargando, EstadoError, EstadoVacio } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import {
  ETIQUETAS_MOTIVO_MERMA,
  type MovimientoDelHistorial,
  type ResumenInventarioPeriodo,
  type TipoMovimientoInventario,
} from '../lib/tipos';
import { formatearCantidad, porPeso } from '../lib/cantidad';

const POR_PAGINA = 50;
// Mismo color de serie que los gráficos (ver components/graficos.tsx).
const SERIE = '#b06f1c';

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function ListaConBarras({
  titulo,
  filas,
}: {
  titulo: string;
  filas: { clave: string; texto: string; detalle: string; centavos: number }[];
}) {
  if (filas.length === 0) return null;
  const maximo = Math.max(...filas.map((f) => f.centavos), 1);
  return (
    <Pieza etiqueta={titulo} ancho="completa">
      <View style={{ gap: espaciado.sm, marginTop: espaciado.sm }}>
        {filas.map((f, i) => (
          <View
            key={f.clave}
            accessible
            accessibilityLabel={`${f.texto}, ${f.detalle}: ${formatearCentavos(f.centavos)}`}
          >
            <View style={styles.barraFila}>
              <Text style={styles.barraTexto} numberOfLines={1}>
                {f.texto} <Text style={styles.detalle}>{f.detalle}</Text>
              </Text>
              <Text style={styles.monto}>{formatearCentavos(f.centavos)}</Text>
            </View>
            <View style={styles.barraFondo}>
              <BarraQueCrece
                horizontal
                orden={i}
                style={[styles.barra, { width: `${Math.max(2, (f.centavos / maximo) * 100)}%` }]}
              />
            </View>
          </View>
        ))}
      </View>
    </Pieza>
  );
}

const TIPOS: { valor: TipoMovimientoInventario | undefined; texto: string }[] = [
  { valor: undefined, texto: 'Todo' },
  { valor: 'abastecimiento', texto: 'Abastecimientos' },
  { valor: 'merma', texto: 'Mermas' },
];

/** Abastecimientos y mermas de un período, con lo gastado y lo perdido. Solo admin. */
export function HistorialInventarioScreen() {
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>(periodoDeHoy);
  const [tipo, setTipo] = useState<TipoMovimientoInventario | undefined>(undefined);
  const [resumen, setResumen] = useState<ResumenInventarioPeriodo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoDelHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimaConsulta = useRef(0);

  const cargar = useCallback(() => {
    if (!token) return;
    const numero = ++ultimaConsulta.current;
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerResumenInventario(token, periodo),
      listarMovimientosInventario(token, periodo, { tipo, limite: POR_PAGINA }),
    ])
      .then(([r, pagina]) => {
        if (numero !== ultimaConsulta.current) return;
        setResumen(r);
        setMovimientos(pagina.movimientos);
        setTotal(pagina.total);
      })
      .catch((err) => {
        if (numero === ultimaConsulta.current)
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (numero === ultimaConsulta.current) setCargando(false);
      });
  }, [token, periodo, tipo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function cargarMas() {
    if (!token || cargando || cargandoMas || movimientos.length >= total) return;
    setCargandoMas(true);
    try {
      const pagina = await listarMovimientosInventario(token, periodo, {
        tipo,
        limite: POR_PAGINA,
        desplazamiento: movimientos.length,
      });
      setMovimientos((previos) => {
        const vistos = new Set(previos.map((m) => m.id));
        return [...previos, ...pagina.movimientos.filter((m) => !vistos.has(m.id))];
      });
      setTotal(pagina.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar más movimientos');
    } finally {
      setCargandoMas(false);
    }
  }

  const hoy = esHoy(periodo);
  const deHoy = hoyISO();

  const encabezado = (
    <View>
      <Banda
        eyebrow={hoy ? 'Inventario · hoy' : `Inventario · ${rangoLegible(periodo)}`}
        titulo={hoy ? 'Historial de inventario' : nombreDelPeriodo(periodo)}
        valor={resumen ? formatearCentavos(resumen.egresoCentavos) : undefined}
        detalle={
          resumen
            ? `Gastado en mercadería · ${formatearCentavos(resumen.perdidaCentavos)} perdidos en ${resumen.cantidadMermas} merma${
                resumen.cantidadMermas === 1 ? '' : 's'
              }`
            : undefined
        }
      >
        <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
      </Banda>
      <LabioHoja />
      <View style={styles.fila}>
        {error && <EstadoError mensaje={error} onReintentar={cargar} />}
        {cargando && !resumen && <EstadoCargando texto="Cargando historial…" />}
        {resumen && (
          <View style={{ gap: espaciado.sm, opacity: cargando ? 0.6 : 1 }}>
            <Mosaico>
              <Pieza
                etiqueta="Gastado"
                valor={formatearCentavos(resumen.egresoCentavos)}
                detalle={`${resumen.cantidadAbastecimientos} compra${resumen.cantidadAbastecimientos === 1 ? '' : 's'}`}
              />
              <Pieza
                etiqueta="Perdido"
                valor={formatearCentavos(resumen.perdidaCentavos)}
                tono={resumen.perdidaCentavos > 0 ? 'rojo' : 'neutro'}
                detalle={
                  resumen.egresoCentavos > 0 && resumen.perdidaCentavos > 0
                    ? `${((resumen.perdidaCentavos / resumen.egresoCentavos) * 100).toFixed(1)}% de lo comprado`
                    : `${resumen.cantidadMermas} merma${resumen.cantidadMermas === 1 ? '' : 's'}`
                }
              />
              <ListaConBarras
                titulo="Por qué se pierde"
                filas={resumen.perdidaPorMotivo.map((m) => ({
                  clave: m.motivo,
                  texto: ETIQUETAS_MOTIVO_MERMA[m.motivo],
                  detalle: `${m.unidades} u.`,
                  centavos: m.centavos,
                }))}
              />
              <ListaConBarras
                titulo="Lo que más se pierde"
                filas={resumen.productosConMasPerdida.map((p) => ({
                  clave: p.nombre,
                  texto: p.nombre,
                  detalle: `${p.unidades} u.`,
                  centavos: p.centavos,
                }))}
              />
              <ListaConBarras
                titulo="A quién le compras"
                filas={resumen.porProveedor.map((p) => ({
                  clave: p.proveedor ?? '—',
                  texto: p.proveedor ?? 'Sin proveedor',
                  detalle: `${p.compras} compra${p.compras === 1 ? '' : 's'}`,
                  centavos: p.centavos,
                }))}
              />
            </Mosaico>
            <View style={styles.chips}>
              {TIPOS.map((t) => (
                <Pressable
                  key={t.texto}
                  onPress={() => setTipo(t.valor)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tipo === t.valor }}
                  style={[styles.chip, tipo === t.valor && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, tipo === t.valor && styles.chipTextoActivo]}>
                    {t.texto}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <FlatList
        data={cargando && movimientos.length === 0 ? [] : movimientos}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={encabezado}
        renderItem={({ item, index }) => {
          const dia = fechaISO(new Date(item.createdAt));
          const nuevoDia = index === 0 || fechaISO(new Date(movimientos[index - 1].createdAt)) !== dia;
          const esMerma = item.tipo === 'merma';
          return (
            <View style={styles.fila}>
              {nuevoDia && (
                <Text style={styles.dia}>
                  {dia === deHoy ? 'Hoy' : fechaLarga(dia)[0].toUpperCase() + fechaLarga(dia).slice(1)}
                </Text>
              )}
              <View style={styles.movimiento}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movimientoTitulo}>
                    <Text style={styles.detalle}>{hora(item.createdAt)} </Text>
                    <Text
                      style={[
                        styles.tipo,
                        {
                          color: esMerma ? colores.rojoPerdida : colores.verdeGanancia,
                        },
                      ]}
                    >
                      {esMerma
                        ? `Merma · ${ETIQUETAS_MOTIVO_MERMA[item.motivo ?? 'otro']}`
                        : 'Abastecimiento'}
                    </Text>
                    {'  '}
                    {item.producto.nombre}
                  </Text>
                  <Text style={styles.detalle}>
                    {porPeso(item.producto.unidad)
                      ? formatearCantidad(item.cantidad, item.producto.unidad)
                      : `${item.cantidad} u.`}{' '}
                    × {formatearCentavos(item.costoUnitarioCentavos)}
                    {item.proveedor ? ` · ${item.proveedor}` : ''}
                    {item.vencimientoLote ? ` · vence ${formatearFechaCorta(item.vencimientoLote)}` : ''}
                    {` · ${item.registradoPor}`}
                  </Text>
                </View>
                <Text style={[styles.monto, esMerma && { color: colores.rojoPerdida }]}>
                  {esMerma ? '−' : ''}
                  {formatearCentavos(item.totalCentavos)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !cargando && !error ? (
            <View style={styles.fila}>
              <EstadoVacio
                icono="file-tray-outline"
                titulo="Sin movimientos"
                descripcion="No hubo abastecimientos ni mermas en este período."
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          cargandoMas ? (
            <ActivityIndicator color={colores.tinta} style={{ marginVertical: espaciado.lg }} />
          ) : movimientos.length > 0 ? (
            <Text style={styles.pie}>
              {movimientos.length < total
                ? `Mostrando ${movimientos.length} de ${total} · desliza para ver más`
                : `${total} movimientos`}
            </Text>
          ) : null
        }
        onEndReached={cargarMas}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: espaciado.xl }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  fila: { paddingHorizontal: espaciado.lg },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: espaciado.sm,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  chipTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  chipTextoActivo: { color: colores.papel },
  barraFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: espaciado.sm,
  },
  barraTexto: { flex: 1, fontSize: 13, color: colores.tinta },
  barraFondo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(228,221,201,0.6)',
    marginTop: 4,
  },
  barra: { height: 6, borderRadius: 3, backgroundColor: SERIE },
  dia: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.tinta,
    marginTop: espaciado.md,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  movimiento: {
    flexDirection: 'row',
    gap: espaciado.sm,
    paddingVertical: espaciado.sm,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  movimientoTitulo: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  tipo: { fontSize: 12, fontWeight: '700' },
  detalle: { fontSize: 12, color: colores.tintaSuave, fontWeight: '400' },
  monto: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
  pie: {
    textAlign: 'center',
    fontSize: 12,
    color: colores.tintaSuave,
    marginVertical: espaciado.lg,
  },
});
