import { useState } from 'react';
import { Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
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
    <SafeAreaView style={styles.contenedor}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>KontaGo</Text>
          <Text style={styles.titulo}>Iniciar sesión</Text>

          <Etiqueta>Correo</Etiqueta>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={estilosCampo.input}
            placeholder="admin@tutienda.com"
          />

          <Etiqueta>Contraseña</Etiqueta>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={estilosCampo.input}
            placeholder="••••••••"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Boton onPress={manejarSubmit} cargando={cargando} style={{ marginTop: espaciado.sm }}>
            Entrar
          </Boton>

          <Boton
            variante="ghost"
            onPress={() => navigation.navigate('Registro')}
            style={{ marginTop: espaciado.sm }}
          >
            ¿No tenés cuenta? Registrá tu tienda
          </Boton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: espaciado.xl },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: colores.tinta,
    textAlign: 'center',
    marginBottom: espaciado.xs,
  },
  titulo: {
    fontSize: 15,
    color: colores.tintaSuave,
    textAlign: 'center',
    marginBottom: espaciado.xl,
  },
  error: {
    color: colores.rojoPerdida,
    fontSize: 13,
    marginBottom: espaciado.sm,
  },
});
