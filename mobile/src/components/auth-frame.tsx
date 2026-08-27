import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colores, espaciado, radios } from '../theme/colores';

type AuthFrameProps = {
  eyebrow: string;
  titulo: string;
  descripcion: string;
  icono: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  footer: ReactNode;
};

/** Marco compartido para el primer contacto con KontaGo. */
export function AuthFrame({
  eyebrow,
  titulo,
  descripcion,
  icono,
  children,
  footer,
}: AuthFrameProps) {
  return (
    <SafeAreaView style={styles.contenedor} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.luzSuperior} />
      <View pointerEvents="none" style={styles.luzInferior} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.teclado}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.marca} accessibilityLabel="KontaGo">
            <View style={styles.marcaIcono}>
              <Ionicons name="storefront-outline" size={22} color={colores.tinta} />
            </View>
            <View>
              <Text style={styles.marcaNombre}>
                Konta<Text style={styles.marcaAcento}>Go</Text>
              </Text>
              <Text style={styles.marcaSubtitulo}>Tu caja, siempre lista</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIcono}>
              <Ionicons name={icono} size={21} color={colores.ambar} />
            </View>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.descripcion}>{descripcion}</Text>
          </View>

          <View style={styles.tarjeta}>{children}</View>
          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  teclado: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: espaciado.xl,
    paddingVertical: espaciado.xxl,
  },
  luzSuperior: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: radios.full,
    backgroundColor: 'rgba(217,140,43,0.14)',
    top: -128,
    right: -88,
  },
  luzInferior: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: radios.full,
    backgroundColor: 'rgba(47,111,79,0.10)',
    bottom: -112,
    left: -92,
  },
  marca: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    marginBottom: espaciado.xxl,
  },
  marcaIcono: {
    width: 42,
    height: 42,
    borderRadius: radios.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.ambar,
    shadowColor: colores.ambar,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 3,
  },
  marcaNombre: {
    color: colores.tinta,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  marcaAcento: { color: colores.ambar },
  marcaSubtitulo: { marginTop: -1, color: colores.tintaSuave, fontSize: 11 },
  hero: { alignItems: 'center', marginBottom: espaciado.xl },
  heroIcono: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.md,
    backgroundColor: 'rgba(217,140,43,0.13)',
    marginBottom: espaciado.md,
  },
  eyebrow: {
    color: colores.ambar,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  titulo: {
    marginTop: espaciado.xs,
    color: colores.tinta,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  descripcion: {
    maxWidth: 330,
    marginTop: espaciado.sm,
    color: colores.tintaSuave,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.lg,
    backgroundColor: colores.superficie,
    padding: espaciado.lg,
    shadowColor: colores.tinta,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  footer: { alignItems: 'center', marginTop: espaciado.lg },
});
