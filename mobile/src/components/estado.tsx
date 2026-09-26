import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarraQueCrece } from './movimiento';
import { colores, espaciado } from '../theme/colores';
import { diasHasta } from '../lib/vencimiento';

/**
 * Piezas chicas para que cada dato diga si está bien o hay que hacer algo,
 * igual que en la web: píldoras de color, la barrita del stock frente a su
 * mínimo y el título de un grupo con cuántos son.
 */

export type TonoPildora = 'ok' | 'warning' | 'danger' | 'neutral' | 'info';

const PILDORA: Record<TonoPildora, { fondo: string; texto: string }> = {
  ok: { fondo: 'rgba(47,111,79,0.1)', texto: colores.verdeGanancia },
  warning: { fondo: 'rgba(217,140,43,0.14)', texto: '#9a5b08' },
  danger: { fondo: 'rgba(182,70,47,0.1)', texto: colores.rojoPerdida },
  neutral: { fondo: 'rgba(28,43,58,0.07)', texto: colores.tintaSuave },
  info: { fondo: 'rgba(47,143,176,0.13)', texto: '#1f6a85' },
};

export function Pildora({
  texto,
  tono = 'neutral',
  icono,
}: {
  texto: string;
  tono?: TonoPildora;
  icono?: keyof typeof Ionicons.glyphMap;
}) {
  const p = PILDORA[tono];
  return (
    <View style={[styles.pildora, { backgroundColor: p.fondo }]}>
      {icono && <Ionicons name={icono} size={11} color={p.texto} />}
      <Text style={[styles.pildoraTexto, { color: p.texto }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

/**
 * Cuánto stock queda frente al mínimo: llena con el triple del mínimo;
 * verde si está bien, ámbar si llegó al mínimo, rojo si se agotó.
 */
export function NivelStock({
  stock,
  minimo,
  nota,
  orden = 0,
}: {
  stock: number;
  minimo: number;
  nota?: string;
  orden?: number;
}) {
  if (minimo <= 0) return null;
  const estado = stock <= 0 ? 'agotado' : stock <= minimo ? 'bajo' : 'bien';
  const color =
    estado === 'agotado' ? colores.rojoPerdida : estado === 'bajo' ? colores.ambar : colores.verdeGanancia;
  const nivel = Math.min(1, stock / (minimo * 3));
  return (
    <View style={styles.nivelFila}>
      <View style={styles.nivelPista}>
        <BarraQueCrece
          horizontal
          orden={orden}
          style={[styles.nivelRelleno, { width: `${Math.max(4, nivel * 100)}%`, backgroundColor: color }]}
        />
      </View>
      {nota && <Text style={styles.nivelNota}>{nota}</Text>}
    </View>
  );
}

/**
 * Cuántos días le quedan a un vencimiento, en grande (igual que en la web):
 * rojo hoy o vencido, ámbar en 1-2 días, suave si falta más.
 */
export function CuentaRegresiva({ fecha }: { fecha: string }) {
  const dias = diasHasta(fecha);
  const tono = dias <= 0 ? 'rojo' : dias <= 2 ? 'ambar' : 'suave';
  const caja =
    tono === 'rojo' ? styles.cuentaRoja : tono === 'ambar' ? styles.cuentaAmbar : styles.cuentaSuave;
  const texto = tono === 'suave' ? { color: '#8f560f' } : { color: '#fff' };
  return (
    <View
      style={[styles.cuenta, caja]}
      accessible
      accessibilityLabel={
        dias < 0 ? 'Vencido' : dias === 0 ? 'Vence hoy' : `Faltan ${dias} día${dias === 1 ? '' : 's'}`
      }
    >
      <Text style={[styles.cuentaNumero, texto, dias === 0 && { fontSize: 13 }]}>
        {dias < 0 ? '!' : dias === 0 ? 'HOY' : dias}
      </Text>
      <Text style={[styles.cuentaNota, texto]}>
        {dias < 0 ? 'venció' : dias === 0 ? 'vence' : dias === 1 ? 'día' : 'días'}
      </Text>
    </View>
  );
}

/** "TE DEBEN  3": el título de un grupo dentro de una lista. */
export function TituloGrupo({ texto, cantidad }: { texto: string; cantidad?: number }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.grupoTexto}>{texto}</Text>
      {cantidad !== undefined && (
        <View style={styles.grupoCantidad}>
          <Text style={styles.grupoCantidadTexto}>{cantidad}</Text>
        </View>
      )}
    </View>
  );
}

/** Una barra fina de proporción (la deuda de un cliente frente a la mayor…). */
export function BarraFina({
  fraccion,
  color,
  fondo = 'rgba(28,43,58,0.08)',
  orden = 0,
}: {
  fraccion: number;
  color: string;
  fondo?: string;
  orden?: number;
}) {
  return (
    <View style={[styles.finaPista, { backgroundColor: fondo }]}>
      <BarraQueCrece
        horizontal
        orden={orden}
        style={[
          styles.finaRelleno,
          { width: `${Math.max(3, Math.min(1, fraccion) * 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cuenta: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaRoja: { backgroundColor: colores.rojoPerdida },
  cuentaAmbar: { backgroundColor: colores.ambar },
  cuentaSuave: { backgroundColor: 'rgba(217,140,43,0.14)' },
  cuentaNumero: { fontSize: 18, fontWeight: '800', lineHeight: 20, fontVariant: ['tabular-nums'] },
  cuentaNota: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pildoraTexto: { fontSize: 11, fontWeight: '700' },
  nivelFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  nivelPista: {
    width: 56,
    height: 5,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(28,43,58,0.08)',
  },
  nivelRelleno: { height: '100%', borderRadius: 999 },
  nivelNota: { fontSize: 11, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm, marginBottom: espaciado.sm },
  grupoTexto: {
    color: colores.tintaSuave,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grupoCantidad: {
    borderRadius: 999,
    backgroundColor: 'rgba(28,43,58,0.07)',
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  grupoCantidadTexto: { fontSize: 11, fontWeight: '700', color: colores.tintaSuave },
  finaPista: { height: 5, overflow: 'hidden', borderRadius: 999 },
  finaRelleno: { height: '100%', borderRadius: 999 },
});
