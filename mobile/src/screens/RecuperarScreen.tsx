import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiError, pedirRecuperacion } from '../lib/api';
import { problemaDelEmail } from '../lib/validacion';
import { AuthFrame } from '../components/auth-frame';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from '../components/ui';
import { vibrar } from '../components/movimiento';
import { colores, espaciado, radios } from '../theme/colores';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Recuperar'>;

// Para no mandar varios emails seguidos por un doble toque.
const ESPERA_REENVIO_S = 60;

/**
 * "¿Olvidaste tu contraseña?": manda un enlace al email. El enlace abre la
 * web, donde se elige la contraseña nueva; después se entra acá con ella.
 * Responde igual exista o no la cuenta (no revela qué emails hay).
 */
export function RecuperarScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [salio, setSalio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const problema = problemaDelEmail(email) ?? (email.trim() ? null : 'Escribí el email de tu cuenta.');

  useEffect(() => {
    if (espera <= 0) return;
    const reloj = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(reloj);
  }, [espera]);

  async function enviar() {
    if (problema) {
      setSalio(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await pedirRecuperacion(email.trim());
      vibrar.exito();
      setEnviado(true);
      setEspera(ESPERA_REENVIO_S);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar. Revisá tu conexión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Recuperar el acceso"
      titulo={enviado ? 'Revisá tu correo' : '¿Olvidaste tu contraseña?'}
      descripcion={
        enviado
          ? 'Si el email tiene una cuenta en KontaGo, te llega un enlace para elegir una contraseña nueva.'
          : 'Escribí el email de tu cuenta y te mandamos un enlace para elegir una nueva.'
      }
      icono="key-outline"
      footer={
        <Boton variante="ghost" onPress={() => navigation.navigate('Login')}>
          Volver a iniciar sesión
        </Boton>
      }
    >
      {enviado ? (
        <View style={{ gap: espaciado.sm }}>
          <Text style={styles.texto}>
            Lo mandamos a <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>.
          </Text>
          <Text style={styles.ayuda}>
            · Abrí el enlace desde este mismo teléfono: vence en 30 minutos y sirve una sola vez.
            {'\n'}· Si no aparece, revisá spam o promociones.
            {'\n'}· Después entrá acá con la contraseña nueva.
          </Text>
          <Boton
            variante="secondary"
            onPress={enviar}
            cargando={enviando}
            disabled={espera > 0}
            style={{ marginTop: espaciado.sm }}
          >
            {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar el enlace'}
          </Boton>
        </View>
      ) : (
        <View style={{ gap: espaciado.xs }}>
          <Etiqueta>Correo</Etiqueta>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onBlur={() => setSalio(true)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            autoFocus={!email}
            style={[estilosCampo.input, salio && problema && estilosCampo.inputInvalido]}
            placeholder="admin@tutienda.com"
            placeholderTextColor={colores.tintaSuave}
            returnKeyType="send"
            onSubmitEditing={enviar}
          />
          <AvisoDeCampo error={salio ? problema : null} />
          {error && (
            <View style={styles.error}>
              <Text style={styles.errorTexto}>{error}</Text>
            </View>
          )}
          <Boton onPress={enviar} cargando={enviando} style={{ marginTop: espaciado.sm }}>
            Mandarme el enlace
          </Boton>
          <Text style={[styles.ayuda, { marginTop: espaciado.md }]}>
            ¿Sos cajero y no usás tu propio email? Pedile al administrador de tu tienda que te ponga
            una contraseña nueva desde Equipo.
          </Text>
        </View>
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 15, color: colores.tinta, lineHeight: 21 },
  ayuda: { fontSize: 13, color: colores.tintaSuave, lineHeight: 19 },
  error: {
    backgroundColor: 'rgba(182,70,47,0.08)',
    borderColor: 'rgba(182,70,47,0.2)',
    borderRadius: radios.md,
    borderWidth: 1,
    padding: espaciado.sm,
    marginBottom: espaciado.sm,
  },
  errorTexto: { color: colores.rojoPerdida, fontSize: 13, textAlign: 'center' },
});
