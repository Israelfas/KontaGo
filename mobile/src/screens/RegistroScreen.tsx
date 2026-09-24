import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { ApiError, WEB_URL } from '../lib/api';
import { CampoContrasena, MedidorDeFuerza } from '../components/campo-contrasena';
import { AuthFrame } from '../components/auth-frame';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from '../components/ui';
import { useCamposTocados } from '../lib/use-campos-tocados';
import {
  faltanALaContrasena,
  fuerzaDeLaContrasena,
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
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [faltaAceptar, setFaltaAceptar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const { salir, tocarTodos, error: errorDe } = useCamposTocados<
    'tienda' | 'admin' | 'email' | 'password'
  >();
  const problemas = {
    tienda: problemaDelNombre(nombreTienda),
    admin: problemaDelNombre(nombreAdmin),
    email: problemaDelEmail(email),
    password: problemaDeLaContrasena(password, email),
  };
  const faltan = faltanALaContrasena(password);
  const errores = {
    tienda: errorDe('tienda', nombreTienda, problemas.tienda),
    admin: errorDe('admin', nombreAdmin, problemas.admin),
    email: errorDe('email', email, problemas.email),
    password: errorDe('password', password, problemas.password),
  };

  async function manejarSubmit() {
    const falta = [nombreTienda, nombreAdmin, email, password].some((v) => !v.trim());
    if (falta || Object.values(problemas).some(Boolean) || !aceptaTerminos) {
      tocarTodos(['tienda', 'admin', 'email', 'password']);
      setFaltaAceptar(!aceptaTerminos);
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
        aceptaTerminos,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Empieza hoy"
      titulo="Crea tu espacio"
      descripcion="Configura tu tienda en minutos. Vas a quedar como administrador para empezar a operar."
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
        <CampoContrasena
          value={password}
          onChangeText={setPassword}
          onBlur={salir('password')}
          nueva
          invalido={!!errores.password}
          placeholder="Una frase de al menos 8 caracteres"
        />
        <AvisoDeCampo
          error={errores.password}
          ayuda={password && faltan > 0 ? `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}.` : null}
        />
        {faltan === 0 && !errores.password && <MedidorDeFuerza {...fuerzaDeLaContrasena(password)} />}

        {/* LOPDP: consentimiento expreso, no una casilla ya marcada. */}
        <View style={styles.terminos}>
          <Pressable
            onPress={() => {
              setAceptaTerminos((v) => !v);
              setFaltaAceptar(false);
            }}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aceptaTerminos }}
            accessibilityLabel="Acepto los términos y condiciones y la política de privacidad"
            style={[styles.casilla, aceptaTerminos && styles.casillaMarcada, faltaAceptar && styles.casillaError]}
          >
            {aceptaTerminos && <Ionicons name="checkmark" size={16} color={colores.papel} />}
          </Pressable>
          <Text style={styles.terminosTexto}>
            Acepto los{' '}
            <Text style={styles.enlace} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)}>
              términos y condiciones
            </Text>{' '}
            y la{' '}
            <Text style={styles.enlace} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacidad`)}>
              política de privacidad
            </Text>
            .
          </Text>
        </View>
        <AvisoDeCampo error={faltaAceptar ? 'Para crear tu cuenta tienes que aceptarlos.' : null} />

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
  terminos: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm, marginBottom: espaciado.sm },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colores.tintaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  casillaMarcada: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  casillaError: { borderColor: colores.rojoPerdida },
  terminosTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: colores.tinta },
  enlace: { fontWeight: '700', textDecorationLine: 'underline' },
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
