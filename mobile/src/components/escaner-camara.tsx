import { useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Boton } from './ui';
import { colores, espaciado, radios } from '../theme/colores';

// La cámara solo detecta estos formatos — son los que efectivamente
// aparecen en productos de supermercado/almacén (ver spec 3.1).
const TIPOS_CODIGO_BARRAS = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

// IMPORTANTE: este objeto debe ser una referencia ESTABLE, no crearse
// dentro del render. Si se recrea en cada render (ej. `{ barcodeTypes:
// [...TIPOS_CODIGO_BARRAS] }` inline en el JSX), CameraView interpreta
// que la config de escaneo "cambió" y reinicia el detector nativo cada
// vez que la pantalla re-renderiza por cualquier motivo — incluso uno
// sin relación con la cámara — y el escaneo nunca llega a estabilizarse
// lo suficiente para reportar una lectura. Este fue el bug real detrás
// de "el sensor no hace nada": si tipeabas algo, cambiaba cualquier
// estado de VentaScreen mientras la cámara estaba abierta, el escáner
// se reiniciaba en loop.
const CONFIGURACION_ESCANER = { barcodeTypes: [...TIPOS_CODIGO_BARRAS] };

/**
 * Visor de cámara que lee códigos de barras. Lo usan Vender (agregar al
 * carrito) e Inventario (elegir el producto a abastecer o dar de merma).
 */
export function EscanerCamara({
  onDetectado,
  onCerrar,
  confirmacion = null,
  estilo,
}: {
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
  confirmacion?: string | null;
  estilo?: StyleProp<ViewStyle>;
}) {
  const [permiso, solicitarPermiso] = useCameraPermissions();
  // Evita disparar el mismo código repetidamente mientras la cámara sigue
  // detectando el mismo código de barras en frames consecutivos.
  const ultimoDetectadoRef = useRef<{ codigo: string; ts: number } | null>(null);

  function manejarEscaneo(resultado: BarcodeScanningResult) {
    const ahora = Date.now();
    const ultimo = ultimoDetectadoRef.current;
    if (ultimo && ultimo.codigo === resultado.data && ahora - ultimo.ts < 2000) {
      return;
    }
    ultimoDetectadoRef.current = { codigo: resultado.data, ts: ahora };
    onDetectado(resultado.data);
  }

  if (!permiso) {
    return null;
  }

  if (!permiso.granted) {
    return (
      <View style={styles.camaraPermisoContenedor}>
        <Text style={styles.camaraPermisoTexto}>
          KontaGo necesita acceso a la cámara para escanear códigos de barras.
        </Text>
        <Boton onPress={solicitarPermiso} style={{ marginTop: espaciado.sm }}>
          Dar permiso
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ marginTop: espaciado.xs }}>
          Cancelar
        </Boton>
      </View>
    );
  }

  return (
    <View style={[styles.camaraContenedor, estilo]}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={CONFIGURACION_ESCANER}
        onBarcodeScanned={manejarEscaneo}
      />
      <View style={styles.camaraOverlay}>
        <View style={styles.camaraMarco} />
      </View>
      {confirmacion && (
        <View style={styles.confirmacionFlash}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.confirmacionFlashTexto} numberOfLines={1}>
            {confirmacion}
          </Text>
        </View>
      )}
      <Boton variante="secondary" onPress={onCerrar} style={styles.camaraCerrar}>
        Cerrar cámara
      </Boton>
    </View>
  );
}

const styles = StyleSheet.create({
  camaraContenedor: { height: 320, marginHorizontal: espaciado.lg, borderRadius: radios.lg, overflow: 'hidden' },
  camaraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camaraMarco: {
    width: '75%',
    height: 100,
    borderWidth: 2,
    borderColor: colores.papel,
    borderRadius: radios.md,
  },
  camaraCerrar: { position: 'absolute', bottom: espaciado.md, alignSelf: 'center' },
  confirmacionFlash: {
    position: 'absolute',
    top: espaciado.sm,
    left: espaciado.sm,
    right: espaciado.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    backgroundColor: 'rgba(47,111,79,0.92)',
    borderRadius: radios.md,
    paddingVertical: espaciado.sm,
    paddingHorizontal: espaciado.md,
  },
  confirmacionFlashTexto: { color: '#fff', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  camaraPermisoContenedor: {
    margin: espaciado.lg,
    padding: espaciado.lg,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg,
    alignItems: 'center',
  },
  camaraPermisoTexto: { color: colores.tintaSuave, fontSize: 13, textAlign: 'center' },
});
