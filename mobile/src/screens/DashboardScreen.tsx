import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { obtenerResumen, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { EstadoCargando, EstadoError } from '../components/ui';
import { Banda, Hoja, IconoPieza, Mosaico, Pieza } from '../components/banda';
import { SelectorPeriodo } from '../components/selector-periodo';
import { BotonExcel } from '../components/boton-excel';
import {
  Anillo,
  GraficoIngreso,
  GraficoPagos,
  GraficoTopProductos,
  Sparkline,
  TarjetaOscura,
} from '../components/graficos';
import { colores, espaciado, radios } from '../theme/colores';
import {
  esHoy,
  nombreDelPeriodo,
  periodoAnterior,
  periodoDeHoy,
  rangoLegible,
  type Periodo,
} from '../lib/periodo';
import type { ResumenPeriodo } from '../lib/tipos';

/** "de hoy", "de los últimos 7 días"… para completar frases. */
function delPeriodo(p: Periodo): string {
  switch (p.clave) {
    case 'hoy':
      return 'de hoy';
    case 'ayer':
      return 'de ayer';
    case 'semana':
      return 'de los últimos 7 días';
    case 'mes':
      return 'de este mes';
    case 'mes-pasado':
      return 'del mes pasado';
    case 'elegido':
      return 'del período';
  }
}

/** "↑ 12 % frente a los 7 días anteriores", o null si no hay con qué comparar. */
function comparacion(actual: ResumenPeriodo, anterior: ResumenPeriodo | null): string | null {
  if (!anterior || anterior.gananciaCentavos <= 0) return null;
  const cambio = Math.round(
    ((actual.gananciaCentavos - anterior.gananciaCentavos) / anterior.gananciaCentavos) * 100,
  );
  const contra = actual.dias === 1 ? 'el día anterior' : `los ${actual.dias} días anteriores`;
  if (cambio === 0) return `Igual que ${contra}.`;
  // "frente a el" → "frente al"
  return `${cambio > 0 ? '↑' : '↓'} ${Math.abs(cambio)} % frente a ${contra}.`.replace(' a el ', ' al ');
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>(periodoDeHoy);
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [anterior, setAnterior] = useState<ResumenPeriodo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Solo la última consulta pisa el estado: si se cambia de período antes
  // de que llegue una respuesta, esa respuesta se descarta.
  const ultimaConsulta = useRef(0);

  const cargar = useCallback(() => {
    if (!token) return;
    const numero = ++ultimaConsulta.current;
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerResumen(token, periodo),
      // Hoy todavía no terminó: compararlo con un día completo engaña.
      esHoy(periodo) ? Promise.resolve(null) : obtenerResumen(token, periodoAnterior(periodo)),
    ])
      .then(([actual, previo]) => {
        if (numero !== ultimaConsulta.current) return;
        setResumen(actual);
        setAnterior(previo);
      })
      .catch((err) => {
        if (numero === ultimaConsulta.current)
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen');
      })
      .finally(() => {
        if (numero === ultimaConsulta.current) setCargando(false);
      });
  }, [token, periodo]);

  // Recarga cada vez que la pestaña gana foco (ej. después de vender),
  // no solo al montar — el resumen cambia con cada venta. Como `cargar`
  // cambia con el período, elegir otro período también recarga.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const hoy = esHoy(periodo);
  const margen =
    resumen && resumen.ingresoBrutoCentavos > 0
      ? Math.round((resumen.gananciaCentavos / resumen.ingresoBrutoCentavos) * 100)
      : 0;
  const ticketPromedio =
    resumen && resumen.cantidadVentas > 0
      ? Math.round(resumen.ingresoBrutoCentavos / resumen.cantidadVentas)
      : 0;
  // El promedio por día cuenta solo los días en que se vendió: un día
  // cerrado (o antes de empezar a usar KontaGo) no es un día flojo.
  const diasConVentas =
    resumen?.agrupadoPor === 'dia' ? resumen.serie.filter((p) => p.centavos > 0).length : 1;
  const frente = resumen ? comparacion(resumen, anterior) : null;
  // Qué parte de lo cobrado es IVA, y qué parte de lo vendido se anuló.
  const ivaPorcentaje =
    resumen && resumen.ingresoBrutoCentavos > 0
      ? (resumen.ivaCentavos / resumen.ingresoBrutoCentavos) * 100
      : 0;
  const vendidoAntes = resumen ? resumen.ingresoBrutoCentavos + resumen.anuladoCentavos : 0;
  const anuladoPorcentaje =
    resumen && vendidoAntes > 0 ? (resumen.anuladoCentavos / vendidoAntes) * 100 : 0;

  return (
    <SafeAreaView style={styles.contenedor} edges={[]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Banda
          eyebrow={hoy ? 'Cierre del día' : `Resumen · ${rangoLegible(periodo)}`}
          titulo={hoy ? 'Resumen' : nombreDelPeriodo(periodo)}
          valor={resumen ? formatearCentavos(resumen.gananciaCentavos) : undefined}
          detalle={
            resumen
              ? resumen.cantidadVentas > 0
                ? `Ganancia real ${delPeriodo(periodo)} · tu margen es el ${margen}% de lo vendido.${frente ? ` ${frente}` : ''}`
                : hoy
                  ? 'Ganancia real de hoy. Todavía no registraste ninguna venta.'
                  : 'No hubo ventas en estas fechas.'
              : undefined
          }
          accion={<BotonExcel periodo={periodo} />}
        >
          <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
        </Banda>

        <Hoja style={styles.hoja}>
          {cargando && !resumen && <EstadoCargando texto="Cargando resumen…" />}
          {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

          {resumen && !error && (
            <View style={{ gap: espaciado.md, opacity: cargando ? 0.6 : 1 }}>
              <Mosaico>
                <Pieza
                  etiqueta="Ingreso bruto"
                  valor={formatearCentavos(resumen.ingresoBrutoCentavos)}
                  adorno={<IconoPieza nombre="cash-outline" />}
                  detalle={
                    diasConVentas > 1
                      ? `${resumen.cantidadVentas} ventas · ${formatearCentavos(
                          Math.round(resumen.ingresoBrutoCentavos / diasConVentas),
                        )} por día`
                      : `${resumen.cantidadVentas} venta${resumen.cantidadVentas === 1 ? '' : 's'}${hoy ? ' hoy' : ''}`
                  }
                >
                  <Sparkline datos={resumen.serie.map((p) => p.centavos)} />
                </Pieza>
                <Pieza
                  etiqueta="Ticket promedio"
                  valor={formatearCentavos(ticketPromedio)}
                  adorno={<IconoPieza nombre="receipt-outline" />}
                  detalle="Lo que gasta cada cliente"
                />
                <Pieza
                  etiqueta="IVA incluido"
                  valor={formatearCentavos(resumen.ivaCentavos)}
                  adorno={
                    <Anillo
                      porcentaje={ivaPorcentaje}
                      color="#2f8fb0"
                      etiqueta="Parte de lo cobrado que es IVA"
                    />
                  }
                  detalle="De lo cobrado · para el SRI"
                />
                <Pieza
                  etiqueta={hoy ? 'Anulado hoy' : 'Anulado'}
                  valor={formatearCentavos(resumen.anuladoCentavos)}
                  tono={resumen.anuladoCentavos > 0 ? 'rojo' : 'neutro'}
                  adorno={
                    <Anillo
                      porcentaje={anuladoPorcentaje}
                      color={colores.rojoPerdida}
                      etiqueta="Parte de lo vendido que se anuló"
                    />
                  }
                  detalle={resumen.anuladoCentavos > 0 ? 'Ya descontado' : 'Sin anulaciones'}
                />
              </Mosaico>

              <TarjetaOscura>
                <GraficoIngreso
                  datos={resumen.serie}
                  agrupadoPor={resumen.agrupadoPor}
                  titulo={resumen.agrupadoPor === 'hora' ? '¿A qué hora vendes?' : 'Ingreso por día'}
                />
              </TarjetaOscura>

              <Mosaico>
                <Pieza etiqueta="Lo que más sale" ancho="completa">
                  <View style={{ marginTop: espaciado.md }}>
                    <GraficoTopProductos datos={resumen.topProductos} />
                  </View>
                </Pieza>
                <Pieza etiqueta="¿Cómo te pagan?" ancho="completa">
                  <View style={{ marginTop: espaciado.md }}>
                    <GraficoPagos
                      efectivoCentavos={resumen.efectivoCentavos}
                      transferenciaCentavos={resumen.transferenciaCentavos}
                      fiadoCentavos={resumen.fiadoCentavos}
                    />
                  </View>
                </Pieza>
              </Mosaico>

              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'VentasHoy',
                    hoy ? undefined : { desde: periodo.desde, hasta: periodo.hasta },
                  )
                }
                style={styles.enlaceVentas}
                hitSlop={8}
              >
                <Ionicons name="receipt-outline" size={16} color={colores.tinta} />
                <Text style={styles.enlaceVentasTexto}>
                  {hoy ? 'Ver ventas de hoy' : `Ver las ventas (${rangoLegible(periodo)})`}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colores.tintaSuave} />
              </Pressable>

              {hoy && resumen.cantidadVentas === 0 && (
                <View style={styles.tipContenedor}>
                  <Ionicons name="bulb-outline" size={18} color={colores.ambar} />
                  <Text style={styles.tipTexto}>
                    Todavía no registraste ninguna venta hoy. Ve a la pestaña{' '}
                    <Text style={{ fontWeight: '700' }}>Vender</Text> para empezar.
                  </Text>
                </View>
              )}
            </View>
          )}
        </Hoja>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  anuladoTexto: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18 },
  enlaceVentas: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs },
  enlaceVentasTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: colores.tinta },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  hoja: { paddingHorizontal: espaciado.lg, paddingBottom: espaciado.xxl },
  scroll: { padding: espaciado.lg, paddingTop: 0, flexGrow: 1 },
  heroTarjeta: { alignItems: 'flex-start' },
  heroIconoFondo: {
    width: 40,
    height: 40,
    borderRadius: radios.md,
    backgroundColor: 'rgba(47,111,79,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaciado.sm,
  },
  heroEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colores.tintaSuave,
  },
  heroValor: {
    fontSize: 36,
    fontWeight: '800',
    color: colores.verdeGanancia,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroDivisor: {
    height: 1,
    backgroundColor: colores.papelLinea,
    alignSelf: 'stretch',
    marginVertical: espaciado.md,
  },
  heroNota: { fontSize: 12, color: colores.tintaSuave, lineHeight: 17 },
  tipContenedor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaciado.sm,
    backgroundColor: 'rgba(217,140,43,0.1)',
    borderRadius: radios.lg,
    padding: espaciado.md,
  },
  tipTexto: { flex: 1, fontSize: 13, color: colores.tinta, lineHeight: 18 },
});