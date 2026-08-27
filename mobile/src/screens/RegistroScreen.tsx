import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { AuthFrame } from '../components/auth-frame';
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
    <AuthFrame
      eyebrow="Empezá hoy"
      titulo="Creá tu espacio"
      descripcion="Configurá tu tienda en minutos. Vas a quedar como administrador para empezar a operar."
      icono="sparkles-outline"
      footer={
        <Boton variante="ghost" onPress={() => navigation.navigate('Login')}>
          Ya tengo cuenta, quiero ingresar
        </Boton>
      }
    >
      <View style={styles.campos}>
        <Etiqueta>Nombre de la tienda</Etiqueta>
        <TextInput
          value={nombreTienda}
          onChangeText={setNombreTienda}
          style={estilosCampo.input}
          placeholder="Mi Tienda"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="organization"
          returnKeyType="next"
        />

        <Etiqueta>Tu nombre</Etiqueta>
        <TextInput
          value={nombreAdmin}
          onChangeText={setNombreAdmin}
          style={estilosCampo.input}
          placeholder="Tu nombre"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="name"
          returnKeyType="next"
        />

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
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={manejarSubmit}
        />

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorTexto}>{error}</Text>
          </View>
        )}

        <Boton onPress={manejarSubmit} cargando={cargando} style={{ marginTop: espaciado.sm }}>
          Crear mi tienda
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
