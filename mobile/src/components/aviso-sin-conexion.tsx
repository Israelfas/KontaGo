import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSinConexion } from '../lib/sin-conexion';
import { formatearCentavos } from '../lib/formato';
import { Boton } from './ui';
import { HojaModal, HojaPie, useHoja } from './hoja-modal';
import { colores, espaciado, radios } from '../theme/colores';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * Arriba de la caja: si no hay conexión, si hay ventas guardadas que
 * todavía no llegaron al servidor, y las que el servidor rechazó (con qué
 * hacer con cada una). Sin nada de eso, no ocupa lugar.
 */
export function AvisoSinConexion() {
  const { sinConexion, pendientes, enviando, catalogo, enviarPendientes } = useSinConexion();
  const [viendoProblemas, setViendoProblemas] = useState(false);

  const porMandar = pendientes.filter((v) => !v.problema).length;
  const conProblema = pendientes.filter((v) => v.problema).length;
  // Con la lista abierta se queda aunque ya no quede nada: se cierra con Listo.
  if (!sinConexion && porMandar === 0 && conProblema === 0 && !viendoProblemas) return null;

  const ventas = (n: number) => `${n} venta${n === 1 ? '' : 's'}`;

  return (
    <View style={styles.contenedor}>
      {(sinConexion || porMandar > 0) && (
        <View style={[styles.aviso, styles.avisoAmbar]} accessibilityLiveRegion="polite">
          {enviando ? (
            <ActivityIndicator size="small" color="#9a5b08" />
          ) : (
            <Ionicons
              name={sinConexion ? 'cloud-offline-outline' : 'cloud-upload-outline'}
              size={18}
              color="#9a5b08"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              {sinConexion ? 'Sin conexión · puedes seguir vendiendo' : `Enviando ${ventas(porMandar)}…`}
            </Text>
            <Text style={styles.detalle}>
              {sinConexion
                ? `${porMandar > 0 ? `${ventas(porMandar)} guardada${porMandar === 1 ? '' : 's'}; se envían solas al volver internet. ` : ''}Productos del catálogo guardado${catalogo ? ` a las ${hora(catalogo.guardadoEn)}` : ''}.`
                : 'Las que se cobraron sin conexión.'}
            </Text>
          </View>
          {sinConexion && porMandar > 0 && !enviando && (
            <Pressable onPress={() => void enviarPendientes()} hitSlop={8}>
              <Text style={styles.accion}>Probar</Text>
            </Pressable>
          )}
        </View>
      )}

      {conProblema > 0 && (
        <Pressable
          onPress={() => setViendoProblemas(true)}
          style={({ pressed }) => [styles.aviso, styles.avisoRojo, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Ionicons name="alert-circle-outline" size={18} color={colores.rojoPerdida} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.titulo, { color: colores.rojoPerdida }]}>
              {ventas(conProblema)} no se pudo enviar
            </Text>
            <Text style={styles.detalle}>Toca para ver qué pasó y decidir.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colores.rojoPerdida} />
        </Pressable>
      )}

      {viendoProblemas && (
        <HojaModal
          titulo="Ventas sin enviar"
          descripcion="El servidor no las aceptó. Corrige lo que dice cada una y reintenta, o descártala si no se cobró."
          icono="alert-circle-outline"
          tono="rojo"
          onCerrar={() => setViendoProblemas(false)}
        >
          <ListaDeProblemas />
        </HojaModal>
      )}
    </View>
  );
}

function ListaDeProblemas() {
  const { pendientes, reintentar, descartar } = useSinConexion();
  const { cerrar } = useHoja();
  const conProblema = pendientes.filter((v) => v.problema);

  function confirmarDescarte(clave: string, total: number) {
    Alert.alert(
      'Descartar venta',
      `La venta de ${formatearCentavos(total)} no se va a registrar. Hazlo solo si no se cobró.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => descartar(clave) },
      ],
    );
  }

  return (
    <View style={{ gap: espaciado.sm }}>
      {conProblema.length === 0 && <Text style={styles.detalle}>Ya no queda ninguna.</Text>}
      {conProblema.map((venta) => (
        <View key={venta.clave} style={styles.tarjeta}>
          <View style={styles.fila}>
            <Text style={styles.total}>{formatearCentavos(venta.totalCentavos)}</Text>
            <Text style={styles.detalle}>Cobrada a las {hora(venta.vendidaEn)}</Text>
          </View>
          <Text style={styles.detalle} numberOfLines={2}>
            {venta.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}
          </Text>
          <Text style={styles.problema}>{venta.problema}</Text>
          <View style={[styles.fila, { marginTop: espaciado.sm }]}>
            <Boton variante="secondary" onPress={() => reintentar(venta.clave)} style={{ flex: 1 }}>
              Reintentar
            </Boton>
            <Boton
              variante="ghost"
              onPress={() => confirmarDescarte(venta.clave, venta.totalCentavos)}
              style={{ flex: 1 }}
            >
              Descartar
            </Boton>
          </View>
        </View>
      ))}
      <HojaPie>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Listo
        </Boton>
      </HojaPie>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { paddingHorizontal: espaciado.lg, gap: espaciado.sm, marginBottom: espaciado.sm },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    padding: espaciado.sm + 2,
    borderRadius: radios.md,
    borderWidth: 1,
  },
  avisoAmbar: { backgroundColor: 'rgba(217,140,43,0.1)', borderColor: 'rgba(217,140,43,0.35)' },
  avisoRojo: { backgroundColor: 'rgba(182,70,47,0.06)', borderColor: 'rgba(182,70,47,0.3)' },
  titulo: { fontSize: 13, fontWeight: '700', color: '#9a5b08' },
  detalle: { fontSize: 12, color: colores.tintaSuave, lineHeight: 17 },
  accion: { fontSize: 13, fontWeight: '700', color: colores.tinta, textDecorationLine: 'underline' },
  tarjeta: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    padding: espaciado.md,
    gap: 4,
  },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaciado.sm },
  total: { fontSize: 17, fontWeight: '800', color: colores.tinta },
  problema: { fontSize: 13, color: colores.rojoPerdida, fontWeight: '600' },
});
