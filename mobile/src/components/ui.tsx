import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, espaciado, radios } from '../theme/colores';

// --- Button ---

type BotonVariante = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const BOTON_ESTILOS: Record<BotonVariante, { fondo: string; texto: string; borde?: string }> = {
  primary: { fondo: colores.tinta, texto: colores.papel },
  secondary: { fondo: colores.superficieSuave, texto: colores.tinta, borde: colores.papelLinea },
  success: { fondo: colores.verdeGanancia, texto: colores.papel },
  danger: { fondo: colores.rojoPerdida, texto: colores.papel },
  ghost: { fondo: 'transparent', texto: colores.tintaSuave },
};

export function Boton({
  children,
  onPress,
  variante = 'primary',
  disabled = false,
  cargando = false,
  style,
}: {
  children: string;
  onPress: () => void;
  variante?: BotonVariante;
  disabled?: boolean;
  cargando?: boolean;
  style?: ViewStyle;
}) {
  const estilo = BOTON_ESTILOS[variante];
  const inactivo = disabled || cargando;
  const conSombra = variante === 'primary' || variante === 'success' || variante === 'danger';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.boton,
        {
          backgroundColor: estilo.fondo,
          borderColor: estilo.borde ?? 'transparent',
          borderWidth: estilo.borde ? 1 : 0,
          opacity: inactivo ? 0.5 : pressed ? 0.85 : 1,
        },
        conSombra && !inactivo ? styles.botonSombra : null,
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={estilo.texto} size="small" />
      ) : (
        <Text style={[styles.botonTexto, { color: estilo.texto }]}>{children}</Text>
      )}
    </Pressable>
  );
}

// --- Card ---

export function Tarjeta({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | (ViewStyle | false | null | undefined)[];
}) {
  return <View style={[styles.tarjeta, style]}>{children}</View>;
}

// --- Encabezado de pantalla (con badge de ícono, como el logo del web) ---

export function EncabezadoPantalla({
  eyebrow,
  titulo,
  descripcion,
  icono,
  accion,
}: {
  eyebrow: string;
  titulo: string;
  descripcion?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  accion?: React.ReactNode;
}) {
  return (
    <View style={styles.encabezado}>
      <View style={{ flex: 1 }}>
        <Text style={styles.encabezadoEyebrow}>{eyebrow}</Text>
        <Text style={styles.encabezadoTitulo}>{titulo}</Text>
        {descripcion && <Text style={styles.encabezadoDescripcion}>{descripcion}</Text>}
      </View>
      {icono && (
        <View style={styles.encabezadoIconoFondo}>
          <Ionicons name={icono} size={22} color={colores.ambar} />
        </View>
      )}
      {accion}
    </View>
  );
}

// --- Sección (subtítulo dentro de una pantalla) ---

export function TituloSeccion({ children }: { children: string }) {
  return <Text style={styles.tituloSeccion}>{children}</Text>;
}

// --- MetricCard ---

const TONOS_METRICA: Record<
  'default' | 'success' | 'danger' | 'warning',
  { color: string; fondoIcono: string }
> = {
  default: { color: colores.tinta, fondoIcono: 'rgba(28,43,58,0.07)' },
  success: { color: colores.verdeGanancia, fondoIcono: 'rgba(47,111,79,0.12)' },
  danger: { color: colores.rojoPerdida, fondoIcono: 'rgba(182,70,47,0.1)' },
  warning: { color: '#a8610b', fondoIcono: 'rgba(217,140,43,0.14)' },
};

export function TarjetaMetrica({
  etiqueta,
  valor,
  detalle,
  icono,
  tono = 'default',
}: {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  tono?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const paleta = TONOS_METRICA[tono];

  return (
    <Tarjeta style={styles.tarjetaMetrica}>
      <View style={styles.tarjetaMetricaFila}>
        <Text style={styles.etiquetaMetrica}>{etiqueta}</Text>
        {icono && (
          <View style={[styles.iconoMetricaFondo, { backgroundColor: paleta.fondoIcono }]}>
            <Ionicons name={icono} size={15} color={paleta.color} />
          </View>
        )}
      </View>
      <Text style={[styles.valorMetrica, { color: paleta.color }]}>{valor}</Text>
      {detalle && <Text style={styles.detalleMetrica}>{detalle}</Text>}
    </Tarjeta>
  );
}

// --- Barra proporcional (comparación simple de 2 valores, sin
// necesitar una librería de gráficos ni datos históricos) ---

export function BarraProporcional({
  etiquetaA,
  valorA,
  colorA = colores.tinta,
  etiquetaB,
  valorB,
  colorB = colores.papelLinea,
}: {
  etiquetaA: string;
  valorA: number;
  colorA?: string;
  etiquetaB: string;
  valorB: number;
  colorB?: string;
}) {
  const total = valorA + valorB;
  const porcentajeA = total > 0 ? Math.round((valorA / total) * 100) : 0;

  return (
    <View>
      <View style={styles.barraProporcionalPista}>
        {total > 0 ? (
          <View style={[styles.barraProporcionalRelleno, { width: `${porcentajeA}%`, backgroundColor: colorA }]} />
        ) : null}
      </View>
      <View style={styles.barraProporcionalLeyenda}>
        <View style={styles.barraProporcionalItem}>
          <View style={[styles.barraProporcionalPunto, { backgroundColor: colorA }]} />
          <Text style={styles.barraProporcionalTexto}>{etiquetaA}</Text>
        </View>
        <View style={styles.barraProporcionalItem}>
          <View style={[styles.barraProporcionalPunto, { backgroundColor: colorB }]} />
          <Text style={styles.barraProporcionalTexto}>{etiquetaB}</Text>
        </View>
      </View>
    </View>
  );
}

// --- Estados ---

export function EstadoCargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <View style={styles.estadoContenedor}>
      <ActivityIndicator color={colores.tinta} />
      <Text style={styles.estadoTexto}>{texto}</Text>
    </View>
  );
}

export function EstadoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <View style={[styles.estadoContenedor, styles.estadoErrorFondo]}>
      <Ionicons name="alert-circle-outline" size={22} color={colores.rojoPerdida} />
      <Text style={[styles.estadoTexto, { color: colores.rojoPerdida }]}>{mensaje}</Text>
      {onReintentar && (
        <Boton variante="secondary" onPress={onReintentar} style={{ marginTop: espaciado.xs }}>
          Reintentar
        </Boton>
      )}
    </View>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono = 'file-tray-outline',
}: {
  titulo: string;
  descripcion?: string;
  icono?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.estadoContenedor}>
      <View style={styles.estadoVacioIconoFondo}>
        <Ionicons name={icono} size={26} color={colores.tintaSuave} />
      </View>
      <Text style={styles.estadoVacioTitulo}>{titulo}</Text>
      {descripcion && <Text style={styles.estadoTexto}>{descripcion}</Text>}
    </View>
  );
}

// --- Campo de texto (wrapper con label, para uso junto a TextInput) ---

export function Etiqueta({ children }: { children: string }) {
  return <Text style={styles.etiquetaCampo}>{children}</Text>;
}

/**
 * Lo que se dice bajo un campo mientras se escribe: `error` en rojo (así no
 * se puede enviar), `advertencia` en ámbar (se puede, pero ojo) o `ayuda`
 * neutra. Lo lee el lector de pantalla sin interrumpir.
 */
export function AvisoDeCampo({
  error,
  advertencia,
  ayuda,
}: {
  error?: string | null;
  advertencia?: string | null;
  ayuda?: string | null;
}) {
  const texto = error || advertencia || ayuda;
  if (!texto) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.aviso,
        error ? { color: colores.rojoPerdida } : advertencia ? { color: COLOR_ADVERTENCIA } : null,
      ]}
    >
      {texto}
    </Text>
  );
}

// El ámbar de la marca es muy claro para texto chico sobre el papel.
const COLOR_ADVERTENCIA = '#93550a';

export const estilosCampo = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.md,
    fontSize: 15,
    color: colores.tinta,
    backgroundColor: colores.blanco,
    marginBottom: espaciado.md,
  },
  inputInvalido: { borderColor: colores.rojoPerdida },
});

const sombraTarjeta = {
  shadowColor: '#1c2b3a',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
};

const styles = StyleSheet.create({
  boton: {
    borderRadius: radios.md,
    paddingVertical: espaciado.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  botonSombra: {
    shadowColor: '#1c2b3a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  botonTexto: {
    fontSize: 15,
    fontWeight: '600',
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    padding: espaciado.lg,
    ...sombraTarjeta,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: espaciado.lg,
    paddingTop: espaciado.md,
    paddingBottom: espaciado.lg,
    gap: espaciado.md,
  },
  encabezadoEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colores.ambar,
    marginBottom: 4,
  },
  encabezadoTitulo: { fontSize: 26, fontWeight: '800', color: colores.tinta, letterSpacing: -0.3 },
  encabezadoDescripcion: { fontSize: 13, color: colores.tintaSuave, marginTop: 4 },
  encabezadoIconoFondo: {
    width: 42,
    height: 42,
    borderRadius: radios.md,
    backgroundColor: 'rgba(217,140,43,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloSeccion: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.tinta,
    marginBottom: espaciado.sm,
  },
  tarjetaMetrica: {
    flex: 1,
  },
  tarjetaMetricaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espaciado.xs,
  },
  etiquetaMetrica: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colores.tintaSuave,
    flexShrink: 1,
  },
  iconoMetricaFondo: {
    width: 26,
    height: 26,
    borderRadius: radios.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: espaciado.xs,
  },
  valorMetrica: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detalleMetrica: {
    fontSize: 12,
    color: colores.tintaSuave,
    marginTop: espaciado.xs,
  },
  estadoContenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espaciado.xxl,
    gap: espaciado.xs,
  },
  estadoErrorFondo: {
    backgroundColor: '#b6462f14',
    borderRadius: radios.lg,
    paddingHorizontal: espaciado.lg,
  },
  estadoTexto: {
    fontSize: 14,
    color: colores.tintaSuave,
    textAlign: 'center',
  },
  estadoVacioIconoFondo: {
    width: 52,
    height: 52,
    borderRadius: radios.full,
    backgroundColor: colores.superficieSuave,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaciado.xs,
  },
  estadoVacioTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.tinta,
  },
  barraProporcionalPista: {
    height: 10,
    borderRadius: radios.full,
    backgroundColor: colores.papelLinea,
    overflow: 'hidden',
  },
  barraProporcionalRelleno: {
    height: '100%',
    borderRadius: radios.full,
  },
  barraProporcionalLeyenda: {
    flexDirection: 'row',
    gap: espaciado.lg,
    marginTop: espaciado.sm,
  },
  barraProporcionalItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barraProporcionalPunto: { width: 8, height: 8, borderRadius: radios.full },
  barraProporcionalTexto: { fontSize: 12, color: colores.tintaSuave },
  // Pegado al campo de arriba (estilosCampo.input deja espaciado.md abajo).
  aviso: {
    marginTop: -espaciado.sm,
    marginBottom: espaciado.sm,
    fontSize: 12,
    lineHeight: 16,
    color: colores.tintaSuave,
  },
  etiquetaCampo: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colores.tintaSuave,
    marginBottom: espaciado.xs,
  },
});