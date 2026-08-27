import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { AuthFrame } from '../components/auth-frame';
import { Boton, Etiqueta, estilosCampo } from '../components/ui';
import { colores, espaciado } from '../theme/colores';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit() {
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion(email.trim(), password);
      // No hace falta navegar manualmente: RootNavigator cambia de stack
      // solo con que `token` deje de ser null.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Bienvenido de vuelta"
      titulo="Tu tienda, bajo control"
      descripcion="Entrá para cobrar, revisar tu inventario y cerrar el día desde un solo lugar."
      icono="shield-checkmark-outline"
      footer={
        <Boton variante="ghost" onPress={() => navigation.navigate('Registro')}>
          ¿No tenés cuenta? Registrá tu tienda
        </Boton>
      }
    >
      <View style={styles.campos}>
        <Etiqueta>Correo</Etiqueta>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={estilosCampo.input}
          placeholder="admin@tutienda.com"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="email"
          returnKeyType="next"
        />

        <Etiqueta>Contraseña</Etiqueta>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={estilosCampo.input}
          placeholder="••••••••"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="password"
          returnKeyType="go"
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
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  campos: { gap: espaciado.xs },
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
