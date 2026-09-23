import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CifraAnimada, Entrada } from './movimiento';
import { colores, espaciado, radios } from '../theme/colores';

/**
 * Encabezado inmersivo, igual que en la web: franja oscura con EL número
 * de la pantalla, y debajo una "hoja" de papel que sube por encima.
 *
 * Antes cada pantalla arrancaba con un título chico sobre el mismo fondo
 * beige que todo lo demás, así que nada pesaba más que nada.
 *
 * El resplandor ámbar se arma con un círculo translúcido en vez de un
 * degradado, para no sumar expo-linear-gradient solo por esto.
 */
export function Banda({
  eyebrow,
  titulo,
  valor,
  detalle,
  accion,
  children,
}: {
  eyebrow: string;
  titulo: string;
  valor?: string;
  detalle?: string;
  accion?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.banda}>
      <View pointerEvents="none" style={styles.resplandorAmbar} />
      <View pointerEvents="none" style={styles.resplandorVerde} />

      {/* Lo que dice, el número y el detalle llegan escalonados. */}
      <View style={styles.cabecera}>
        <Entrada style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.titulo}>{titulo}</Text>
        </Entrada>
        {accion}
      </View>

      {valor !== undefined && (
        <Entrada orden={1}>
          <CifraAnimada texto={valor} style={styles.valor} />
        </Entrada>
      )}
      {detalle && (
        <Entrada orden={2}>
          <Text style={styles.detalle}>{detalle}</Text>
        </Entrada>
      )}
      {children}
    </View>
  );
}

/** El papel que tapa el borde inferior de la franja. */
export function Hoja({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hoja, style]}>{children}</View>;
}

/**
 * El borde superior redondeado de la hoja, para las pantallas que usan
 * FlatList: va justo después de la franja, dentro del encabezado de la
 * lista, y tapa su borde inferior igual que <Hoja>.
 */
export function LabioHoja() {
  return <View style={styles.labio} />;
}

/** Fila del mosaico: las piezas van de a dos. */
export function Mosaico({ children }: { children: ReactNode }) {
  // Cada pieza entra una detrás de otra.
  let orden = 0;
  return (
    <View style={styles.mosaico}>
      {Children.map(children, (hijo) =>
        isValidElement(hijo) && hijo.type === Pieza
          ? cloneElement(hijo as ReactElement<{ orden?: number }>, { orden: orden++ })
          : hijo,
      )}
    </View>
  );
}

export function Pieza({
  etiqueta,
  valor,
  detalle,
  tono = 'neutro',
  ancho = 'mitad',
  orden = 0,
  children,
}: {
  etiqueta: string;
  valor?: string;
  detalle?: string;
  tono?: 'neutro' | 'verde' | 'rojo';
  ancho?: 'mitad' | 'completa';
  /** Lugar en el mosaico, para entrar escalonada (lo pone Mosaico). */
  orden?: number;
  children?: ReactNode;
}) {
  const color =
    tono === 'verde' ? colores.verdeGanancia : tono === 'rojo' ? colores.rojoPerdida : colores.tinta;

  return (
    <Entrada orden={orden + 1} style={[styles.pieza, ancho === 'completa' && styles.piezaCompleta]}>
      <Text style={styles.piezaEtiqueta}>{etiqueta}</Text>
      {valor !== undefined && <CifraAnimada texto={valor} style={[styles.piezaValor, { color }]} />}
      {children}
      {detalle && <Text style={styles.piezaDetalle}>{detalle}</Text>}
    </Entrada>
  );
}

const styles = StyleSheet.create({
  banda: {
    overflow: 'hidden',
    backgroundColor: '#1b2c3c',
    paddingHorizontal: espaciado.lg,
    paddingTop: espaciado.lg,
    paddingBottom: espaciado.xxl + espaciado.md,
  },
  resplandorAmbar: {
    position: 'absolute',
    top: -110,
    right: -70,
    width: 230,
    height: 230,
    borderRadius: radios.full,
    backgroundColor: 'rgba(217,140,43,0.22)',
  },
  resplandorVerde: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: radios.full,
    backgroundColor: 'rgba(47,111,79,0.16)',
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
  eyebrow: {
    color: 'rgba(246,243,236,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titulo: {
    marginTop: 2,
    color: colores.papel,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  // El número que la pantalla viene a contar: antes competía con todo lo demás.
  valor: {
    marginTop: espaciado.md,
    color: colores.papel,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  detalle: {
    marginTop: espaciado.xs,
    color: 'rgba(246,243,236,0.75)',
    fontSize: 13,
    lineHeight: 19,
  },
  hoja: {
    flex: 1,
    marginTop: -espaciado.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colores.papel,
    paddingTop: espaciado.lg,
  },
  labio: {
    height: espaciado.xl,
    marginTop: -espaciado.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colores.papel,
  },
  mosaico: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaciado.sm,
  },
  pieza: {
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.lg,
    backgroundColor: colores.superficie,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.md,
  },
  piezaCompleta: { flexBasis: '100%' },
  piezaEtiqueta: {
    color: colores.tintaSuave,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  piezaValor: {
    marginTop: espaciado.xs,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums'],
  },
  piezaDetalle: { marginTop: espaciado.xs, color: colores.tintaSuave, fontSize: 12, lineHeight: 16 },
});
