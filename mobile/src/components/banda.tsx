import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  adorno,
  children,
}: {
  etiqueta: string;
  valor?: string;
  detalle?: string;
  tono?: 'neutro' | 'verde' | 'rojo';
  ancho?: 'mitad' | 'completa';
  /** Lugar en el mosaico, para entrar escalonada (lo pone Mosaico). */
  orden?: number;
  /** Un ícono o un anillo chico, arriba a la derecha. */
  adorno?: ReactNode;
  children?: ReactNode;
}) {
  const color =
    tono === 'verde' ? colores.verdeGanancia : tono === 'rojo' ? colores.rojoPerdida : colores.tinta;

  return (
    <Entrada orden={orden + 1} style={[styles.pieza, ancho === 'completa' && styles.piezaCompleta]}>
      {adorno ? (
        <View style={styles.piezaCabecera}>
          <Text style={[styles.piezaEtiqueta, { flex: 1 }]}>{etiqueta}</Text>
          {adorno}
        </View>
      ) : (
        <Text style={styles.piezaEtiqueta}>{etiqueta}</Text>
      )}
      {valor !== undefined && <CifraAnimada texto={valor} style={[styles.piezaValor, { color }]} />}
      {children}
      {detalle && <Text style={styles.piezaDetalle}>{detalle}</Text>}
    </Entrada>
  );
}

export interface DatoDeBanda {
  etiqueta: string;
  valor: string;
  /** Texto chico al lado del valor ("de 7", "· Vecina"). */
  nota?: string;
  /** El valor en ámbar: hay algo que mirar. */
  alerta?: boolean;
  /** Un punto de color antes de la etiqueta (la forma de pago). */
  punto?: string;
}

/**
 * Los números que acompañan al principal, sobre la franja oscura: de a
 * dos o tres por fila, en recuadros translúcidos (como en la web).
 */
export function DatosBanda({ datos }: { datos: DatoDeBanda[] }) {
  return (
    <View style={styles.datos}>
      {datos.map((d, i) => (
        <Entrada key={d.etiqueta} orden={3 + i} style={styles.dato}>
          <View style={styles.datoCabecera}>
            {d.punto && <View style={[styles.datoPunto, { backgroundColor: d.punto }]} />}
            <Text style={styles.datoEtiqueta} numberOfLines={1}>
              {d.etiqueta}
            </Text>
          </View>
          <Text style={[styles.datoValor, d.alerta && styles.datoValorAlerta]} numberOfLines={1}>
            {d.valor}
            {d.nota ? <Text style={styles.datoNota}> {d.nota}</Text> : null}
          </Text>
        </Entrada>
      ))}
    </View>
  );
}

/** Ícono sobre un fondo ámbar suave, para el rincón de una pieza. */
export function IconoPieza({ nombre }: { nombre: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconoPieza}>
      <Ionicons name={nombre} size={15} color="#9a5f14" />
    </View>
  );
}

const styles = StyleSheet.create({
  datos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaciado.sm,
    marginTop: espaciado.md,
  },
  dato: {
    flexGrow: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radios.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
  },
  datoCabecera: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  datoPunto: { width: 7, height: 7, borderRadius: 999 },
  datoEtiqueta: {
    flexShrink: 1,
    color: 'rgba(246,243,236,0.62)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  datoValor: {
    marginTop: 2,
    color: colores.papel,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  datoValorAlerta: { color: '#ffd08a' },
  datoNota: { color: 'rgba(246,243,236,0.62)', fontSize: 11, fontWeight: '500' },
  iconoPieza: {
    width: 30,
    height: 30,
    marginTop: -4,
    marginRight: -4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,169,59,0.18)',
  },
  piezaCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
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
