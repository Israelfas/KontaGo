import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colores, espaciado, radios } from '../theme/colores';

export function TerminosScreen() {
  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avisoContenedor}>
          <Ionicons name="alert-circle-outline" size={18} color={colores.ambar} />
          <Text style={styles.avisoTexto}>
            Este texto es una plantilla genérica de referencia, no un documento legal
            terminado. Antes de publicarlo o de hacer que los usuarios lo acepten,
            conviene que lo revise un abogado y lo ajuste a las leyes de Ecuador y a
            cómo funciona realmente tu negocio.
          </Text>
        </View>

        <Text style={styles.seccionTitulo}>1. Sobre KontaGo</Text>
        <Text style={styles.parrafo}>
          KontaGo es una herramienta de gestión de inventario y punto de venta pensada
          para pequeños negocios. Al usarla, aceptás estos términos.
        </Text>

        <Text style={styles.seccionTitulo}>2. Tu cuenta</Text>
        <Text style={styles.parrafo}>
          Sos responsable de mantener segura tu contraseña y de la actividad que
          ocurra dentro de tu cuenta. Avisanos si sospechás un uso no autorizado.
        </Text>

        <Text style={styles.seccionTitulo}>3. Tus datos</Text>
        <Text style={styles.parrafo}>
          Los datos que cargás (productos, ventas, inventario) son tuyos. Los usamos
          únicamente para operar el servicio, no los vendemos a terceros.
        </Text>

        <Text style={styles.seccionTitulo}>4. Disponibilidad</Text>
        <Text style={styles.parrafo}>
          Hacemos lo posible por mantener el servicio disponible, pero no
          garantizamos que esté libre de interrupciones o errores en todo momento.
        </Text>

        <Text style={styles.seccionTitulo}>5. Cambios</Text>
        <Text style={styles.parrafo}>
          Estos términos pueden actualizarse. Te avisaremos ante cambios importantes.
        </Text>

        <Text style={styles.fechaTexto}>Última actualización: pendiente de definir</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.sm },
  avisoContenedor: {
    flexDirection: 'row',
    gap: espaciado.sm,
    backgroundColor: 'rgba(217,140,43,0.1)',
    borderRadius: radios.lg,
    padding: espaciado.md,
    marginBottom: espaciado.sm,
  },
  avisoTexto: { flex: 1, fontSize: 12, color: colores.tinta, lineHeight: 17 },
  seccionTitulo: { fontSize: 14, fontWeight: '700', color: colores.tinta, marginTop: espaciado.sm },
  parrafo: { fontSize: 13, color: colores.tintaSuave, lineHeight: 19 },
  fechaTexto: { fontSize: 11, color: colores.tintaSuave, marginTop: espaciado.lg, fontStyle: 'italic' },
});