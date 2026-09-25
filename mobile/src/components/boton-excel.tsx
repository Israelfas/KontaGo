import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../lib/auth-context';
import { ApiError, descargarReporteExcel, type RangoDeFechas } from '../lib/api';
import { vibrar } from './movimiento';
import { colores, radios } from '../theme/colores';

/**
 * Baja el reporte del período en Excel y abre el menú de compartir del
 * celular: WhatsApp al contador, correo, Drive. Va en la franja oscura del
 * Resumen, arriba a la derecha.
 */
export function BotonExcel({ periodo }: { periodo: RangoDeFechas }) {
  const { token } = useAuth();
  const [bajando, setBajando] = useState(false);

  async function bajarYCompartir() {
    if (!token || bajando) return;
    vibrar.toque();
    setBajando(true);
    try {
      const archivo = await descargarReporteExcel(token, periodo);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(archivo.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
          dialogTitle: 'Enviar el reporte',
        });
      } else {
        Alert.alert('Reporte listo', 'Este dispositivo no permite compartir archivos.');
      }
    } catch (err) {
      vibrar.error();
      Alert.alert(
        'No se pudo',
        err instanceof ApiError ? err.message : 'No se pudo preparar el Excel. Prueba de nuevo.',
      );
    } finally {
      setBajando(false);
    }
  }

  return (
    <Pressable
      onPress={bajarYCompartir}
      disabled={bajando}
      accessibilityRole="button"
      accessibilityLabel="Bajar el reporte en Excel y compartirlo"
      accessibilityState={{ busy: bajando }}
      hitSlop={8}
      style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
    >
      {bajando ? (
        <ActivityIndicator size="small" color={colores.papel} />
      ) : (
        <Ionicons name="share-outline" size={15} color={colores.papel} />
      )}
      <Text style={styles.texto}>{bajando ? 'Preparando…' : 'Excel'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: 'rgba(246,243,236,0.22)',
    backgroundColor: 'rgba(246,243,236,0.08)',
  },
  presionado: { transform: [{ scale: 0.96 }], backgroundColor: 'rgba(246,243,236,0.16)' },
  texto: { color: colores.papel, fontSize: 13, fontWeight: '700' },
});
