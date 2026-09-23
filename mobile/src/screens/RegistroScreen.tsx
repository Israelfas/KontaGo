import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';
import { AuthFrame } from '../components/auth-frame';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from '../components/ui';
import { useCamposTocados } from '../lib/use-campos-tocados';
import {
  ayudaDeLaContrasena,
  problemaDeLaContrasena,
  problemaDelEmail,
  problemaDelNombre,
} from '../lib/validacion';
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
  const { salir, tocarTodos, error: errorDe } = useCamposTocados<
    'tienda' | 'admin' | 'email' | 'password'
  >();
  const problemas = {
    tienda: problemaDelNombre(nombreTienda),
    admin: problemaDelNombre(nombreAdmin),
    email: problemaDelEmail(email),
    password: problemaDeLaContrasena(password),
  };
  const errores = {
    tienda: errorDe('tienda', nombreTienda, problemas.tienda),
    admin: errorDe('admin', nombreAdmin, problemas.admin),
    email: errorDe('email', email, problemas.email),
    password: errorDe('password', password, problemas.password),
  };

  async function manejarSubmit() {
    const falta = [nombreTienda, nombreAdmin, email, password].some((v) => !v.trim());
    if (falta || Object.values(problemas).some(Boolean)) {
      tocarTodos(['tienda', 'admin', 'email', 'password']);
      return;
    }
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
          onBlur={salir('tienda')}
          style={[estilosCampo.input, errores.tienda && estilosCampo.inputInvalido]}
          placeholder="Mi Tienda"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="organization"
          returnKeyType="next"
        />
        <AvisoDeCampo error={errores.tienda} />

        <Etiqueta>Tu nombre</Etiqueta>
        <TextInput
          value={nombreAdmin}
          onChangeText={setNombreAdmin}
          onBlur={salir('admin')}
          style={[estilosCampo.input, errores.admin && estilosCampo.inputInvalido]}
          placeholder="Tu nombre"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="name"
          returnKeyType="next"
        />
        <AvisoDeCampo error={errores.admin} />

        <Etiqueta>Correo</Etiqueta>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onBlur={salir('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[estilosCampo.input, errores.email && estilosCampo.inputInvalido]}
          placeholder="admin@tutienda.com"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="email"
          returnKeyType="next"
        />
        <AvisoDeCampo error={errores.email} />

        <Etiqueta>Contraseña</Etiqueta>
        <TextInput
          value={password}
          onChangeText={setPassword}
          onBlur={salir('password')}
          secureTextEntry
          style={[estilosCampo.input, errores.password && estilosCampo.inputInvalido]}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colores.tintaSuave}
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={manejarSubmit}
        />
        <AvisoDeCampo error={errores.password} ayuda={ayudaDeLaContrasena(password)} />

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
