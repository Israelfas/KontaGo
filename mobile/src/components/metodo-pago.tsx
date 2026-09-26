import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MetodoPago } from '../lib/tipos';

/**
 * Cómo se pagó, siempre con el mismo color e ícono (los de la web y de la
 * dona del resumen): efectivo ámbar, transferencia azul, fiado violeta.
 */
export const COLOR_PAGO: Record<MetodoPago, { nombre: string; color: string; fondo: string; texto: string }> = {
  efectivo: { nombre: 'Efectivo', color: '#d98c2b', fondo: 'rgba(217,140,43,0.14)', texto: '#8f560f' },
  transferencia: {
    nombre: 'Transferencia',
    color: '#2f8fb0',
    fondo: 'rgba(47,143,176,0.13)',
    texto: '#1f6a85',
  },
  fiado: { nombre: 'Al fiado', color: '#8a63c9', fondo: 'rgba(138,99,201,0.13)', texto: '#6a45a8' },
};

const ICONO: Record<MetodoPago, keyof typeof Ionicons.glyphMap> = {
  efectivo: 'cash-outline',
  transferencia: 'swap-horizontal',
  fiado: 'book-outline',
};

export function ChipMetodoPago({ metodo, detalle }: { metodo: MetodoPago; detalle?: string }) {
  const m = COLOR_PAGO[metodo];
  return (
    <View style={[styles.chip, { backgroundColor: m.fondo }]}>
      <Ionicons name={ICONO[metodo]} size={13} color={m.texto} />
      <Text style={[styles.texto, { color: m.texto }]} numberOfLines={1}>
        {m.nombre}
        {detalle ? <Text style={styles.detalle}> · {detalle}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  texto: { flexShrink: 1, fontSize: 12, fontWeight: '700' },
  detalle: { fontWeight: '500' },
});
