import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={[
        styles.boton,
        {
          backgroundColor: estilo.fondo,
          borderColor: estilo.borde ?? 'transparent',
          borderWidth: estilo.borde ? 1 : 0,
          opacity: inactivo ? 0.5 : 1,
        },
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

export function Tarjeta({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.tarjeta, style]}>{children}</View>;
}

// --- MetricCard ---

export function TarjetaMetrica({
  etiqueta,
  valor,
  detalle,
  tono = 'default',
}: {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  tono?: 'default' | 'success' | 'danger';
}) {
  const colorValor =
    tono === 'success' ? colores.verdeGanancia : tono === 'danger' ? colores.rojoPerdida : colores.tinta;

  return (
    <Tarjeta style={styles.tarjetaMetrica}>
      <Text style={styles.etiquetaMetrica}>{etiqueta}</Text>
      <Text style={[styles.valorMetrica, { color: colorValor }]}>{valor}</Text>
      {detalle && <Text style={styles.detalleMetrica}>{detalle}</Text>}
    </Tarjeta>
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
      <Text style={[styles.estadoTexto, { color: colores.rojoPerdida }]}>{mensaje}</Text>
      {onReintentar && (
        <Boton variante="secondary" onPress={onReintentar} style={{ marginTop: espaciado.sm }}>
          Reintentar
        </Boton>
      )}
    </View>
  );
}

export function EstadoVacio({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <View style={styles.estadoContenedor}>
      <Text style={styles.estadoVacioTitulo}>{titulo}</Text>
      {descripcion && <Text style={styles.estadoTexto}>{descripcion}</Text>}
    </View>
  );
}

// --- Campo de texto (wrapper con label, para uso junto a TextInput) ---

export function Etiqueta({ children }: { children: string }) {
  return <Text style={styles.etiquetaCampo}>{children}</Text>;
}

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
});

const styles = StyleSheet.create({
  boton: {
    borderRadius: radios.md,
    paddingVertical: espaciado.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
  },
  tarjetaMetrica: {
    flex: 1,
  },
  etiquetaMetrica: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colores.tintaSuave,
    marginBottom: espaciado.xs,
  },
  valorMetrica: {
    fontSize: 22,
    fontWeight: '700',
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
    gap: espaciado.sm,
  },
  estadoErrorFondo: {
    backgroundColor: '#b6462f1a',
    borderRadius: radios.md,
  },
  estadoTexto: {
    fontSize: 14,
    color: colores.tintaSuave,
    textAlign: 'center',
  },
  estadoVacioTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: colores.tinta,
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
