import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

/**
 * Movimiento sobrio, igual que en la web: todo llega rápido, frena al
 * llegar y no rebota. Solo se anima transform y opacity, que corren en el
 * hilo nativo (useNativeDriver) y no traban la pantalla.
 *
 * Con "Reducir movimiento" activado en el teléfono, cada cosa aparece
 * directamente en su lugar final.
 */

// Frena al llegar, como algo que se desliza y se detiene.
export const FRENAR = Easing.bezier(0.22, 1, 0.36, 1);

let reducidoActual = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reducidoActual = v;
  })
  .catch(() => {});

/** Si el teléfono pide menos movimiento (se actualiza si cambia el ajuste). */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(reducidoActual);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reducidoActual = v;
        setReducido(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reducidoActual = v;
      setReducido(v);
    });
    return () => sub.remove();
  }, []);
  return reducido;
}

// --- Números que cuentan ---

// Montos y conteos tal como los arma formatearCentavos (es-EC): "$1.234,50",
// "−$0,55", "30". Lo que no calce se muestra sin animar.
const PATRON = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([^\d]*)$/;
const DURACION_CIFRA = 700;

function leer(texto: string) {
  const m = PATRON.exec(texto);
  if (!m) return null;
  const [, antes, entero, decimales = '', despues] = m;
  return {
    antes,
    despues,
    decimales: decimales.length,
    valor: Number(`${entero.replace(/\./g, '')}.${decimales || '0'}`),
  };
}

function armar(valor: number, decimales: number): string {
  const [entero, fraccion] = valor.toFixed(decimales).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraccion ? `${conMiles},${fraccion}` : conMiles;
}

const frenar = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Un número que cuenta hasta su valor al aparecer y, si cambia (otro
 * período, un producto más), sigue desde el que se ve. El lector de
 * pantalla lee solo el valor final.
 */
export function CifraAnimada({ texto, style }: { texto: string; style?: StyleProp<TextStyle> }) {
  const destino = leer(texto);
  const reducido = useMovimientoReducido();
  const [mostrado, setMostrado] = useState(0);
  const actual = useRef(0);
  const destinoValor = destino?.valor;

  useEffect(() => {
    if (destinoValor === undefined) return;
    const desde = actual.current;
    if (reducido || desde === destinoValor) {
      actual.current = destinoValor;
      setMostrado(destinoValor);
      return;
    }
    let cuadro = 0;
    let inicio: number | null = null;
    const paso = (ahora: number) => {
      inicio ??= ahora;
      const t = Math.min(1, (ahora - inicio) / DURACION_CIFRA);
      const valor = desde + (destinoValor - desde) * frenar(t);
      actual.current = valor;
      setMostrado(valor);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [destinoValor, reducido]);

  if (!destino) return <Text style={style}>{texto}</Text>;
  return (
    <Text style={[style, { fontVariant: ['tabular-nums'] }]} accessibilityLabel={texto}>
      {destino.antes}
      {armar(mostrado, destino.decimales)}
      {destino.despues}
    </Text>
  );
}

// --- Entrada escalonada ---

/**
 * Aparece subiendo un poco y aclarándose. `orden` escalona los elementos de
 * una misma fila o lista (40 ms entre uno y otro).
 */
export function Entrada({
  children,
  orden = 0,
  style,
}: {
  children: ReactNode;
  orden?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducido = useMovimientoReducido();
  const progreso = useRef(new Animated.Value(reducidoActual ? 1 : 0)).current;

  useEffect(() => {
    if (reducido) {
      progreso.setValue(1);
      return;
    }
    const animacion = Animated.timing(progreso, {
      toValue: 1,
      duration: 480,
      delay: 60 + orden * 40,
      easing: FRENAR,
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [progreso, orden, reducido]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progreso,
          transform: [
            { translateY: progreso.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// --- Barras que crecen ---

/**
 * Una barra de gráfico que crece desde su base (vertical) o desde la
 * izquierda (horizontal) al aparecer, una detrás de otra.
 */
export function BarraQueCrece({
  orden = 0,
  horizontal = false,
  style,
}: {
  orden?: number;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reducido = useMovimientoReducido();
  const escala = useRef(new Animated.Value(reducidoActual ? 1 : 0)).current;

  useEffect(() => {
    if (reducido) {
      escala.setValue(1);
      return;
    }
    const animacion = Animated.timing(escala, {
      toValue: 1,
      duration: 700,
      delay: 200 + orden * (horizontal ? 50 : 30),
      easing: FRENAR,
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [escala, orden, horizontal, reducido]);

  return (
    <Animated.View
      style={[
        style,
        horizontal
          ? { transformOrigin: 'left', transform: [{ scaleX: escala }] }
          : { transformOrigin: 'bottom', transform: [{ scaleY: escala }] },
      ]}
    />
  );
}

// --- Vibración ---

/**
 * Toques cortos solo donde suman: una venta cobrada, algo que se guardó,
 * un error. Si el teléfono no tiene motor de vibración, no pasa nada.
 */
export const vibrar = {
  exito: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  toque: () => Haptics.selectionAsync().catch(() => {}),
};

// --- Venta confirmada ---

/**
 * El círculo verde aparece y enseguida el check, como una firma. Va junto
 * con vibrar.exito(): lo que se ve y lo que se siente, en el mismo momento.
 */
export function CheckAnimado({ tamano = 64, color }: { tamano?: number; color: string }) {
  const reducido = useMovimientoReducido();
  const circulo = useRef(new Animated.Value(reducidoActual ? 1 : 0)).current;
  const marca = useRef(new Animated.Value(reducidoActual ? 1 : 0)).current;

  useEffect(() => {
    if (reducido) {
      circulo.setValue(1);
      marca.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(circulo, { toValue: 1, duration: 360, easing: FRENAR, useNativeDriver: true }),
      Animated.timing(marca, { toValue: 1, duration: 280, easing: FRENAR, useNativeDriver: true }),
    ]).start();
  }, [circulo, marca, reducido]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: 2.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: circulo,
        transform: [{ scale: circulo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      <Animated.View
        style={{
          opacity: marca,
          transform: [{ scale: marca.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }}
      >
        <Ionicons name="checkmark" size={tamano * 0.55} color={color} />
      </Animated.View>
    </Animated.View>
  );
}
