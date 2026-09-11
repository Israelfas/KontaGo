import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Tarjeta } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { RootStackParamList } from '../navigation/RootNavigator';

const PLANES = [
  {
    id: 'gratuito',
    nombre: 'Gratis',
    descripcion: 'Lo que estás usando ahora — sin costo, sin límite de tiempo.',
  },
  {
    id: 'pago',
    nombre: 'Pago',
    descripcion: 'Pensado para más de una sucursal o más usuarios. Precio a definir.',
  },
  {
    id: 'enterprise',
    nombre: 'Enterprise',
    descripcion: 'Para operaciones grandes, con soporte dedicado. A medida.',
  },
];

export function SuscripcionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Suscripcion'>>();
  const planActual = route.params?.plan ?? 'gratuito';

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avisoContenedor}>
          <Ionicons name="construct-outline" size={18} color={colores.ambar} />
          <Text style={styles.avisoTexto}>
            Los planes de pago todavía no están conectados a ninguna pasarela real
            (Stripe, PayPal, etc.). Por ahora esta pantalla solo muestra tu plan
            actual — el cobro real hay que definirlo e integrarlo aparte.
          </Text>
        </View>

        {PLANES.map((plan) => {
          const esActual = plan.id === planActual;
          return (
            <Tarjeta
              key={plan.id}
              style={[styles.tarjetaPlan, esActual && styles.tarjetaPlanActual]}
            >
              <View style={styles.filaTitulo}>
                <Text style={styles.nombrePlan}>{plan.nombre}</Text>
                {esActual && (
                  <View style={styles.pillActual}>
                    <Text style={styles.pillActualTexto}>Tu plan</Text>
                  </View>
                )}
              </View>
              <Text style={styles.descripcionPlan}>{plan.descripcion}</Text>
            </Tarjeta>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.md },
  avisoContenedor: {
    flexDirection: 'row',
    gap: espaciado.sm,
    backgroundColor: 'rgba(217,140,43,0.1)',
    borderRadius: radios.lg,
    padding: espaciado.md,
    marginBottom: espaciado.xs,
  },
  avisoTexto: { flex: 1, fontSize: 12, color: colores.tinta, lineHeight: 17 },
  tarjetaPlan: { gap: 4 },
  tarjetaPlanActual: { borderColor: colores.tinta, borderWidth: 1.5 },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm },
  nombrePlan: { fontSize: 16, fontWeight: '700', color: colores.tinta },
  pillActual: {
    backgroundColor: 'rgba(47,111,79,0.12)',
    paddingHorizontal: espaciado.sm,
    paddingVertical: 2,
    borderRadius: radios.full,
  },
  pillActualTexto: { fontSize: 10, fontWeight: '700', color: colores.verdeGanancia, textTransform: 'uppercase' },
  descripcionPlan: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18 },
});