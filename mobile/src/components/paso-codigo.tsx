import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { Boton, Etiqueta, estilosCampo } from './ui';
import { vibrar } from './movimiento';
import { colores, espaciado } from '../theme/colores';

/**
 * Segundo paso del ingreso cuando la cuenta tiene la verificación en dos
 * pasos: el código de 6 dígitos de la app autenticadora o, sin el
 * celular, uno de recuperación. Con los 6 dígitos se envía solo.
 */
export function PasoCodigo({ desafio, onVolver }: { desafio: string; onVolver: () => void }) {
  const { completarConCodigo } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [deRecuperacion, setDeRecuperacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<TextInput>(null);

  async function enviar(valor: string) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await completarConCodigo(desafio, valor);
    } catch (err) {
      vibrar.error();
      setError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.');
      setCodigo('');
      setEnviando(false);
      campoRef.current?.focus();
    }
  }

  function alEscribir(valor: string) {
    if (deRecuperacion) {
      setCodigo(valor.slice(0, 12));
      return;
    }
    const digitos = valor.replace(/\D/g, '').slice(0, 6);
    setCodigo(digitos);
    if (digitos.length === 6) void enviar(digitos);
  }

  const listo = deRecuperacion
    ? codigo.replace(/[^a-z0-9]/gi, '').length === 8
    : codigo.length === 6;

  return (
    <View>
      <Text style={styles.texto}>
        {deRecuperacion
          ? 'Escribe uno de los códigos de recuperación que guardaste al activar la verificación. Cada uno sirve una sola vez.'
          : 'Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator…) y escribe el código de 6 dígitos de KontaGo.'}
      </Text>

      <Etiqueta>{deRecuperacion ? 'Código de recuperación' : 'Código de verificación'}</Etiqueta>
      <TextInput
        ref={campoRef}
        value={codigo}
        onChangeText={alEscribir}
        style={[estilosCampo.input, styles.campo]}
        keyboardType={deRecuperacion ? 'default' : 'number-pad'}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!enviando}
        placeholder={deRecuperacion ? 'xxxx-xxxx' : '000000'}
        placeholderTextColor={colores.tintaSuave}
        accessibilityLabel={deRecuperacion ? 'Código de recuperación' : 'Código de verificación'}
      />

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Boton onPress={() => void enviar(codigo)} cargando={enviando} disabled={!listo}>
        Verificar
      </Boton>

      <View style={styles.fila}>
        <Pressable
          onPress={() => {
            setDeRecuperacion((v) => !v);
            setCodigo('');
            setError(null);
          }}
          hitSlop={8}
        >
          <Text style={styles.enlace}>
            {deRecuperacion ? 'Usar la app autenticadora' : 'No tengo el celular'}
          </Text>
        </Pressable>
        <Pressable onPress={onVolver} hitSlop={8}>
          <Text style={styles.volver}>Volver</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 20, color: colores.tintaSuave, marginBottom: espaciado.md },
  campo: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: espaciado.md,
  },
  enlace: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.tinta,
    textDecorationLine: 'underline',
  },
  volver: { fontSize: 14, color: colores.tintaSuave },
});
