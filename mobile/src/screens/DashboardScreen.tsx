import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { obtenerResumenDelDia, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { BarraProporcional, EncabezadoPantalla, EstadoCargando, EstadoError, Tarjeta, TarjetaMetrica } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { ResumenDelDia } from '../lib/tipos';

function TarjetaGanancia({ resumen }: { resumen: ResumenDelDia }) {
  // No hay endpoint de costo total todavía, pero ganancia + "resto" (que
  // incluye costo de mercadería) sí se puede visualizar contra el
  // ingreso bruto sin inventar datos: ganancia real vs. lo que no fue
  // ganancia de ese ingreso.
  const restoCentavos = Math.max(resumen.ingresoBrutoCentavos - resumen.gananciaCentavos, 0);

  return (
    <Tarjeta style={styles.heroTarjeta}>
      <View style={styles.heroIconoFondo}>
        <Ionicons name="trending-up" size={20} color={colores.verdeGanancia} />
      </View>
      <Text style={styles.heroEtiqueta}>GANANCIA REAL DE HOY</Text>
      <Text style={styles.heroValor}>{formatearCentavos(resumen.gananciaCentavos)}</Text>

      {resumen.ingresoBrutoCentavos > 0 && (
        <View style={{ marginTop: espaciado.md, alignSelf: 'stretch' }}>
          <BarraProporcional
            etiquetaA="Ganancia"
            valorA={resumen.gananciaCentavos}
            colorA={colores.verdeGanancia}
            etiquetaB="Resto"
            valorB={restoCentavos}
          />
        </View>
      )}

      <View style={styles.heroDivisor} />
      <Text style={styles.heroNota}>
        Margen (venta − costo) de cada producto vendido, no el ingreso bruto.
      </Text>
    </Tarjeta>
  );
}

export function DashboardScreen() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<ResumenDelDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    obtenerResumenDelDia(token)
      .then(setResumen)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen'))
      .finally(() => setCargando(false));
  }, [token]);

  // Recarga cada vez que la pestaña gana foco (ej. después de vender),
  // no solo al montar — el resumen del día cambia con cada venta.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['top']}>
      <EncabezadoPantalla eyebrow="CIERRE DEL DÍA" titulo="Resumen" icono="bar-chart" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {cargando && <EstadoCargando texto="Cargando resumen…" />}
        {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

        {resumen && !cargando && !error && (
          <View style={{ gap: espaciado.md }}>
            <TarjetaGanancia resumen={resumen} />

            <View style={{ flexDirection: 'row', gap: espaciado.md }}>
              <TarjetaMetrica
                etiqueta="Ventas de hoy"
                valor={resumen.cantidadVentas}
                icono="receipt-outline"
              />
              <TarjetaMetrica
                etiqueta="Ingreso bruto"
                valor={formatearCentavos(resumen.ingresoBrutoCentavos)}
                icono="cash-outline"
              />
            </View>

            {resumen.cantidadVentas === 0 && (
              <View style={styles.tipContenedor}>
                <Ionicons name="bulb-outline" size={18} color={colores.ambar} />
                <Text style={styles.tipTexto}>
                  Todavía no registraste ninguna venta hoy. Andá a la pestaña{' '}
                  <Text style={{ fontWeight: '700' }}>Vender</Text> para empezar.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
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