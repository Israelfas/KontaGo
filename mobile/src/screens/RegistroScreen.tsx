import { useState } from 'react';
import { Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { Boton, Etiqueta, estilosCampo } from '../components/ui';
import { colores, espaciado } from '../theme/colores';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Registro'>;

export function RegistroScreen({ navigation }: Props) {
  const { registrarse } = useAuth();
  const [nombreTienda, setNombreTienda] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit() {
    setError(null);
    setCargando(true);
    try {
      await registrarse({
        nombreTienda: nombreTienda.trim(),
        nombreAdmin: nombreAdmin.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
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
          <Text style={styles.titulo}>Registrá tu tienda</Text>

          <Etiqueta>Nombre de la tienda</Etiqueta>
          <TextInput
            value={nombreTienda}
            onChangeText={setNombreTienda}
            style={estilosCampo.input}
            placeholder="Mi Tienda"
          />

          <Etiqueta>Tu nombre</Etiqueta>
          <TextInput
            value={nombreAdmin}
            onChangeText={setNombreAdmin}
            style={estilosCampo.input}
            placeholder="Isra Fas"
          />

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
            Crear cuenta
          </Boton>

          <Boton
            variante="ghost"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: espaciado.sm }}
          >
            Ya tengo cuenta
          </Boton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: espaciado.xl },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colores.tinta,
    textAlign: 'center',
    marginBottom: espaciado.xl,
  },
  error: {
    color: colores.rojoPerdida,
    fontSize: 13,
    marginBottom: espaciado.sm,
  },
});
