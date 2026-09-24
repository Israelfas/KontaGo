import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSSO, useAuth as useClerkAuth } from '@clerk/expo';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { AuthFrame } from '../components/auth-frame';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from '../components/ui';
import { CampoContrasena } from '../components/campo-contrasena';
import { problemaDelEmail } from '../lib/validacion';
import { colores, espaciado } from '../theme/colores';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { iniciarSesion, loginConClerk } = useAuth();
  const { startSSOFlow } = useSSO();
  const { getToken } = useClerkAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [salioDelEmail, setSalioDelEmail] = useState(false);
  const problemaEmail = salioDelEmail ? problemaDelEmail(email) : null;

  async function manejarSubmit() {
    if (problemaDelEmail(email)) {
      setSalioDelEmail(true);
      return;
    }
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  async function manejarGoogle() {
    setError(null);
    setCargandoGoogle(true);
    try {
      const redirectUrl = Linking.createURL('/sso-callback');
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      // Sin sesión: o cancelaste en la pantalla de Google, o Clerk pide
      // pasos extra para crear la cuenta. Antes esto no decía nada y la
      // pantalla se quedaba como si el botón no hubiera hecho nada.
      if (!createdSessionId || !setActive) {
        setError('No se completó el ingreso con Google. Prueba de nuevo o entra con tu email.');
        return;
      }
      await setActive({ session: createdSessionId });
      const token = await getToken();
      if (!token) throw new Error('Sin token de Clerk');
      await loginConClerk(token);
    } catch (err) {
      console.error('Login con Google falló', err);
      setError(
        err instanceof ApiError
          ? err.message
          : `No se pudo continuar con Google: ${(err as Error)?.message ?? 'error desconocido'}`,
      );
    } finally {
      setCargandoGoogle(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Bienvenido de vuelta"
      titulo="Tu tienda, bajo control"
      descripcion="Entra para cobrar, revisar tu inventario y cerrar el día desde un solo lugar."
      icono="shield-checkmark-outline"
      footer={
        <Boton variante="ghost" onPress={() => navigation.navigate('Registro')}>
          ¿No tienes cuenta? Registra tu tienda
        </Boton>
      }
    >
      <View style={styles.campos}>
        <Etiqueta>Correo</Etiqueta>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onBlur={() => setSalioDelEmail(true)}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[estilosCampo.input, problemaEmail && estilosCampo.inputInvalido]}
          placeholder="admin@tutienda.com"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="email"
          returnKeyType="next"
        />
        <AvisoDeCampo error={problemaEmail} />

        <View style={styles.filaEtiqueta}>
          <Etiqueta>Contraseña</Etiqueta>
          <Pressable
            onPress={() =>
              navigation.navigate('Recuperar', { email: problemaDelEmail(email) ? undefined : email.trim() })
            }
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.olvide}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </View>
        <CampoContrasena
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          onSubmitEditing={manejarSubmit}
        />

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorTexto}>{error}</Text>
          </View>
        )}

        <Boton onPress={manejarSubmit} cargando={cargando} style={{ marginTop: espaciado.sm }}>
          Ingresar a KontaGo
        </Boton>

        <Boton variante="ghost" onPress={manejarGoogle} cargando={cargandoGoogle}>
          Continuar con Google
        </Boton>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  campos: { gap: espaciado.xs },
  filaEtiqueta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  olvide: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.tinta,
    textDecorationLine: 'underline',
    textDecorationColor: colores.ambar,
  },
  error: {
    backgroundColor: 'rgba(182,70,47,0.08)',
    borderColor: 'rgba(182,70,47,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: espaciado.sm,
    padding: espaciado.sm,
  },
  errorTexto: { color: colores.rojoPerdida, fontSize: 13, textAlign: 'center' },
});