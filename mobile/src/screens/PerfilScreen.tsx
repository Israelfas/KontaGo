import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { obtenerPerfil, ApiError, type Perfil } from '../lib/api';
import { Boton, EstadoCargando, EstadoError, Tarjeta } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { HAY_SOPORTE, MOSTRAR_SUSCRIPCION } from '../lib/config-app';

const ETIQUETAS_PLAN: Record<NonNullable<Perfil['plan']>, string> = {
  gratuito: 'Gratis',
  pago: 'Pago',
  enterprise: 'Enterprise',
};

function FilaOpcion({
  icono,
  titulo,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.filaOpcion}>
      <View style={styles.filaOpcionIconoFondo}>
        <Ionicons name={icono} size={18} color={colores.tinta} />
      </View>
      <Text style={styles.filaOpcionTexto}>{titulo}</Text>
      <Ionicons name="chevron-forward" size={18} color={colores.tintaSuave} />
    </Pressable>
  );
}

export function PerfilScreen() {
  const { token, cerrarSesion } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    obtenerPerfil(token)
      .then(setPerfil)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu cuenta'))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function confirmarCierreSesion() {
    Alert.alert('Cerrar sesión', '¿Querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => cerrarSesion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cargando && <EstadoCargando texto="Cargando tu cuenta…" />}
        {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

        {perfil && !cargando && !error && (
          <>
            <Tarjeta style={styles.tarjetaCuenta}>
              <View style={styles.avatarFondo}>
                <Text style={styles.avatarInicial}>{perfil.nombre.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.nombreTexto}>{perfil.nombre}</Text>
              <Text style={styles.emailTexto}>{perfil.email}</Text>
              <View style={styles.pillsFila}>
                <View style={styles.pill}>
                  <Text style={styles.pillTexto}>
                    {perfil.rol === 'admin' ? 'Admin' : 'Cajero'}
                  </Text>
                </View>
                {perfil.tienda && (
                  <View style={styles.pill}>
                    <Text style={styles.pillTexto}>{perfil.tienda}</Text>
                  </View>
                )}
              </View>
            </Tarjeta>

            {/* La caja es de cada uno: cajero y admin. */}
            <Text style={styles.seccionTitulo}>Tu caja</Text>
            <Tarjeta style={styles.grupoOpciones}>
              <FilaOpcion
                icono="cash-outline"
                titulo="Caja (abrir, retiros, cierre)"
                onPress={() => navigation.navigate('Caja')}
              />
            </Tarjeta>

            {/* Equipo y suscripción son de la tienda: solo el admin. */}
            {perfil.rol === 'admin' && (
              <>
                <Text style={styles.seccionTitulo}>Tu tienda</Text>
                <Tarjeta style={styles.grupoOpciones}>
                  <FilaOpcion
                    icono="storefront-outline"
                    titulo="Datos de la tienda (ticket)"
                    onPress={() => navigation.navigate('Tienda')}
                  />
                  <View style={styles.separador} />
                  <FilaOpcion
                    icono="people-outline"
                    titulo="Equipo"
                    onPress={() => navigation.navigate('Equipo')}
                  />
                  {MOSTRAR_SUSCRIPCION && (
                    <>
                      <View style={styles.separador} />
                      <FilaOpcion
                        icono="card-outline"
                        titulo={`Suscripción · Plan ${perfil.plan ? ETIQUETAS_PLAN[perfil.plan] : '—'}`}
                        onPress={() => navigation.navigate('Suscripcion', { plan: perfil.plan })}
                      />
                    </>
                  )}
                </Tarjeta>
              </>
            )}

            <Text style={styles.seccionTitulo}>Ayuda</Text>
            <Tarjeta style={styles.grupoOpciones}>
              <FilaOpcion
                icono="school-outline"
                titulo="Tutorial de la app"
                onPress={() => navigation.navigate('Tutorial')}
              />
              {HAY_SOPORTE && (
                <>
                  <View style={styles.separador} />
                  <FilaOpcion
                    icono="chatbubble-ellipses-outline"
                    titulo="Contacto y soporte"
                    onPress={() => navigation.navigate('Contacto')}
                  />
                </>
              )}
              <View style={styles.separador} />
              <FilaOpcion
                icono="document-text-outline"
                titulo="Términos y condiciones"
                onPress={() => navigation.navigate('Terminos')}
              />
            </Tarjeta>

            <Boton variante="danger" onPress={confirmarCierreSesion} style={{ marginTop: espaciado.lg }}>
              Cerrar sesión
            </Boton>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.md },
  tarjetaCuenta: { alignItems: 'center', paddingVertical: espaciado.xl },
  avatarFondo: {
    width: 60,
    height: 60,
    borderRadius: radios.full,
    backgroundColor: colores.tinta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaciado.sm,
  },
  avatarInicial: { fontSize: 24, fontWeight: '800', color: colores.papel },
  nombreTexto: { fontSize: 17, fontWeight: '700', color: colores.tinta },
  emailTexto: { fontSize: 13, color: colores.tintaSuave, marginTop: 2 },
  pillsFila: { flexDirection: 'row', gap: espaciado.xs, marginTop: espaciado.sm },
  pill: {
    backgroundColor: colores.superficieSuave,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    paddingHorizontal: espaciado.sm,
    paddingVertical: 4,
    borderRadius: radios.full,
  },
  pillTexto: { fontSize: 11, fontWeight: '600', color: colores.tinta },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.tintaSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: espaciado.sm,
    marginBottom: -espaciado.xs,
  },
  grupoOpciones: { padding: 0, overflow: 'hidden' },
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    padding: espaciado.md,
  },
  filaOpcionIconoFondo: {
    width: 34,
    height: 34,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaOpcionTexto: { flex: 1, fontSize: 14, color: colores.tinta, fontWeight: '500' },
  separador: { height: 1, backgroundColor: colores.papelLinea, marginLeft: espaciado.md + 34 + espaciado.sm },
});