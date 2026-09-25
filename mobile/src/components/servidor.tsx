import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SERVIDOR_CAMBIABLE,
  cambiarServidor,
  normalizarServidor,
  probarServidor,
  servidorActual,
  servidorDeFabrica,
} from '../lib/api';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from './ui';
import { HojaModal, HojaPie, useHoja } from './hoja-modal';
import { colores, espaciado } from '../theme/colores';

const sinProtocolo = (url: string) => url.replace(/^https?:\/\//, '');

/**
 * Abajo del login, solo en un APK de prueba (backend en una PC de la red):
 * a qué dirección se conecta la app, y cómo cambiarla cuando la PC cambia
 * de IP (otra red, el router le dio otra).
 */
export function FilaServidor() {
  const [servidor, setServidor] = useState(servidorActual);
  const [cambiando, setCambiando] = useState(false);
  if (!SERVIDOR_CAMBIABLE) return null;

  return (
    <View style={styles.fila}>
      <Text style={styles.texto}>Servidor: {sinProtocolo(servidor)}</Text>
      <Pressable onPress={() => setCambiando(true)} hitSlop={8} accessibilityRole="button">
        <Text style={styles.enlace}>Cambiar</Text>
      </Pressable>

      {cambiando && (
        <HojaModal
          titulo="Dirección del servidor"
          descripcion="La IP de la PC donde corre KontaGo. En la PC, búscala con ipconfig (Dirección IPv4). El celular tiene que estar en la misma red."
          icono="server-outline"
          onCerrar={() => setCambiando(false)}
        >
          <FormularioServidor onGuardado={setServidor} />
        </HojaModal>
      )}
    </View>
  );
}

function FormularioServidor({ onGuardado }: { onGuardado: (url: string) => void }) {
  const { cerrar } = useHoja();
  const [texto, setTexto] = useState(sinProtocolo(servidorActual()));
  const [error, setError] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const deFabrica = servidorDeFabrica();

  async function guardar(url: string | null) {
    const destino = url ?? deFabrica;
    setError(null);
    setProbando(true);
    const contesta = await probarServidor(destino);
    setProbando(false);
    if (!contesta) {
      setError(
        `No contesta ${sinProtocolo(destino)}. Revisa que el backend esté levantado y que el celular esté en la misma red que la PC.`,
      );
      return;
    }
    cambiarServidor(url);
    onGuardado(destino);
    cerrar();
  }

  function probarYGuardar() {
    const url = normalizarServidor(texto);
    if (!url) {
      setError('Escribe una IP, por ejemplo 192.168.1.20 (o 192.168.1.20:3000).');
      return;
    }
    void guardar(url === deFabrica ? null : url);
  }

  return (
    <View style={{ gap: espaciado.xs }}>
      <Etiqueta>Dirección</Etiqueta>
      <TextInput
        value={texto}
        onChangeText={(t) => {
          setTexto(t);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="192.168.1.20:3000"
        placeholderTextColor={colores.tintaSuave}
        style={[estilosCampo.input, error && estilosCampo.inputInvalido]}
        onSubmitEditing={probarYGuardar}
        returnKeyType="done"
      />
      <AvisoDeCampo error={error} />
      {servidorActual() !== deFabrica && (
        <Pressable onPress={() => void guardar(null)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.enlace}>Volver a la de fábrica ({sinProtocolo(deFabrica)})</Text>
        </Pressable>
      )}
      <HojaPie>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton onPress={probarYGuardar} cargando={probando} style={{ flex: 1 }}>
          Probar y guardar
        </Boton>
      </HojaPie>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espaciado.sm,
    marginTop: espaciado.md,
  },
  texto: { fontSize: 12, color: colores.tintaSuave },
  enlace: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.tinta,
    textDecorationLine: 'underline',
    textDecorationColor: colores.ambar,
  },
});
