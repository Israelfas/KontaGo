import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMovimientoReducido } from './movimiento';
import { colores, espaciado, radios } from '../theme/colores';

// La curva de las hojas de iOS: sale decidida y se asienta sin rebotar.
const DESLIZAR = Easing.bezier(0.32, 0.72, 0, 1);
const ALTO_PANTALLA = Dimensions.get('window').height;

const ContextoHoja = createContext<{ cerrar: () => void }>({ cerrar: () => {} });

/** Para que un formulario adentro cierre la hoja (con su animación) al terminar. */
export const useHoja = () => useContext(ContextoHoja);

/**
 * Hoja que sube desde abajo para editar o registrar algo sin perder la
 * pantalla de fondo. Se cierra con la X, tocando afuera, con "atrás" en
 * Android o arrastrándola hacia abajo desde el encabezado: sigue al dedo y
 * al soltar decide por la velocidad, no solo por cuánto se bajó.
 *
 * Se muestra mientras está montada: `{editando && <HojaModal …/>}`.
 */
export function HojaModal({
  titulo,
  descripcion,
  icono,
  tono = 'neutro',
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  tono?: 'neutro' | 'verde' | 'rojo';
  onCerrar: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reducido = useMovimientoReducido();
  const desplazamiento = useRef(new Animated.Value(reducido ? 0 : ALTO_PANTALLA)).current;
  const fondo = useRef(new Animated.Value(reducido ? 1 : 0)).current;
  const cerrando = useRef(false);

  useEffect(() => {
    if (reducido) return;
    Animated.parallel([
      Animated.timing(desplazamiento, {
        toValue: 0,
        duration: 380,
        easing: DESLIZAR,
        useNativeDriver: true,
      }),
      Animated.timing(fondo, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrar = useCallback(
    (velocidad = 0) => {
      if (cerrando.current) return;
      cerrando.current = true;
      if (reducido) {
        onCerrar();
        return;
      }
      Animated.parallel([
        Animated.timing(desplazamiento, {
          toValue: ALTO_PANTALLA,
          // Si se la tiró con fuerza, se va más rápido.
          duration: velocidad > 1.5 ? 160 : 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fondo, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onCerrar());
    },
    [desplazamiento, fondo, onCerrar, reducido],
  );

  // El gesto se crea una sola vez: llama siempre a la versión actual de cerrar.
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  }, [cerrar]);

  // Arrastre desde el encabezado: 1:1 con el dedo hacia abajo; hacia
  // arriba resiste (no hay más hoja que mostrar).
  const arrastre = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        desplazamiento.setValue(g.dy > 0 ? g.dy : g.dy / 4);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          cerrarRef.current(g.vy);
        } else {
          Animated.spring(desplazamiento, {
            toValue: 0,
            velocity: g.vy,
            bounciness: 0,
            speed: 14,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const colorIcono =
    tono === 'verde' ? colores.verdeGanancia : tono === 'rojo' ? colores.rojoPerdida : colores.tinta;
  const fondoIcono =
    tono === 'verde'
      ? 'rgba(47,111,79,0.12)'
      : tono === 'rojo'
        ? 'rgba(182,70,47,0.1)'
        : 'rgba(28,43,58,0.07)';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => cerrar()}>
      <KeyboardAvoidingView
        style={styles.contenedor}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, { opacity: fondo }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => cerrar()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        </Animated.View>

        <Animated.View
          style={[styles.hoja, { transform: [{ translateY: desplazamiento }] }]}
          accessibilityViewIsModal
        >
          <View {...arrastre.panHandlers}>
            <View style={styles.agarre} />
            <View style={styles.cabecera}>
              {icono && (
                <View style={[styles.icono, { backgroundColor: fondoIcono }]}>
                  <Ionicons name={icono} size={20} color={colorIcono} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo} accessibilityRole="header">
                  {titulo}
                </Text>
                {descripcion && <Text style={styles.descripcion}>{descripcion}</Text>}
              </View>
              <Pressable
                onPress={() => cerrar()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                style={({ pressed }) => [styles.cerrar, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                <Ionicons name="close" size={18} color={colores.tintaSuave} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.cuerpo}
            contentContainerStyle={{
              paddingHorizontal: espaciado.lg,
              paddingTop: espaciado.md,
              paddingBottom: insets.bottom + espaciado.lg,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <ContextoHoja.Provider value={{ cerrar: () => cerrar() }}>{children}</ContextoHoja.Provider>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Los botones de la hoja, separados del formulario por una línea. */
export function HojaPie({ children }: { children: ReactNode }) {
  return <View style={styles.pie}>{children}</View>;
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'flex-end' },
  fondo: { backgroundColor: 'rgba(16,26,36,0.45)' },
  hoja: {
    maxHeight: '92%',
    backgroundColor: colores.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#101a24',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  agarre: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: radios.full,
    backgroundColor: colores.papelLinea,
    marginTop: espaciado.sm,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaciado.md,
    paddingHorizontal: espaciado.lg,
    paddingTop: espaciado.md,
    paddingBottom: espaciado.md,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 18, fontWeight: '800', color: colores.tinta, letterSpacing: -0.4 },
  descripcion: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colores.tintaSuave },
  cerrar: {
    width: 32,
    height: 32,
    borderRadius: radios.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,43,58,0.06)',
  },
  cuerpo: { flexGrow: 0 },
  pie: {
    flexDirection: 'row',
    gap: espaciado.sm,
    marginTop: espaciado.lg,
    paddingTop: espaciado.md,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
  },
});
