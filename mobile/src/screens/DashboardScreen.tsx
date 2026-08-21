import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { obtenerResumenDelDia, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { EstadoCargando, EstadoError, TarjetaMetrica } from '../components/ui';
import { colores, espaciado } from '../theme/colores';
import type { ResumenDelDia } from '../lib/tipos';

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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CIERRE DEL DÍA</Text>
        <Text style={styles.titulo}>Resumen del día</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {cargando && <EstadoCargando texto="Cargando resumen…" />}
        {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

        {resumen && !cargando && !error && (
          <View style={{ gap: espaciado.md }}>
            <View style={{ flexDirection: 'row', gap: espaciado.md }}>
              <TarjetaMetrica etiqueta="Ventas de hoy" valor={resumen.cantidadVentas} />
              <TarjetaMetrica
                etiqueta="Ganancia real"
                valor={formatearCentavos(resumen.gananciaCentavos)}
                tono="success"
              />
            </View>
            <TarjetaMetrica
              etiqueta="Ingreso bruto"
              valor={formatearCentavos(resumen.ingresoBrutoCentavos)}
            />
            <Text style={styles.nota}>
              La ganancia es el margen (venta − costo) de cada producto vendido, no el ingreso bruto.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  header: { paddingHorizontal: espaciado.lg, paddingTop: espaciado.md, paddingBottom: espaciado.sm },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colores.ambar,
    marginBottom: espaciado.xs,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.tinta },
  scroll: { padding: espaciado.lg },
  nota: { fontSize: 12, color: colores.tintaSuave, marginTop: espaciado.xs },
});
