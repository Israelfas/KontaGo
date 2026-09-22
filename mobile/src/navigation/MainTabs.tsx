import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VentaScreen } from '../screens/VentaScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductosScreen } from '../screens/ProductosScreen';
import { InventarioScreen } from '../screens/InventarioScreen';
import { useAuth } from '../lib/auth-context';
import { colores, espaciado, radios } from '../theme/colores';
import type { RootStackParamList } from './RootNavigator';

export type MainTabParamList = {
  Vender: undefined;
  Resumen: undefined;
  Productos: undefined;
  Inventario: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONOS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Vender: 'cart',
  Resumen: 'bar-chart',
  Productos: 'cube',
  Inventario: 'clipboard',
};
const ICONOS_INACTIVOS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Vender: 'cart-outline',
  Resumen: 'bar-chart-outline',
  Productos: 'cube-outline',
  Inventario: 'clipboard-outline',
};

const ETIQUETAS_ROL: Record<'admin' | 'cajero', string> = {
  admin: 'Admin',
  cajero: 'Cajero',
};

// Un solo ícono de perfil en el header, compartido por las 4 pestañas —
// evita meter una 5ta pestaña (apretaría la barra inferior en un
// celular). Ahora navega a la pantalla de Perfil (cuenta, tutorial,
// términos, contacto, suscripción, cerrar sesión) en vez de solo
// mostrar una alerta de cerrar sesión.
function BotonPerfil() {
  const { usuario } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const etiquetaRol = usuario ? ETIQUETAS_ROL[usuario.rol] : '';

  return (
    <Pressable onPress={() => navigation.navigate('Perfil')} style={styles.botonPerfil} hitSlop={8}>
      {etiquetaRol ? (
        <View style={styles.rolPill}>
          <Text style={styles.rolPillTexto}>{etiquetaRol}</Text>
        </View>
      ) : null}
      <Ionicons name="person-circle-outline" size={26} color={colores.tinta} />
    </Pressable>
  );
}

export function MainTabs() {
  const { usuario } = useAuth();
  // El cajero vende y consulta el catálogo; resumen (ganancias) e
  // inventario son del dueño (el backend igual le responde 403).
  const esAdmin = usuario?.rol === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colores.papel },
        headerRight: () => <BotonPerfil />,
        tabBarActiveTintColor: colores.tinta,
        tabBarInactiveTintColor: colores.tintaSuave,
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopColor: colores.papelLinea,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={focused ? ICONOS[route.name] : ICONOS_INACTIVOS[route.name]}
            size={22}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Vender" component={VentaScreen} />
      {esAdmin && <Tab.Screen name="Resumen" component={DashboardScreen} />}
      <Tab.Screen name="Productos" component={ProductosScreen} />
      {esAdmin && <Tab.Screen name="Inventario" component={InventarioScreen} />}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  botonPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    marginRight: espaciado.lg,
  },
  rolPill: {
    backgroundColor: 'rgba(217,140,43,0.14)',
    paddingHorizontal: espaciado.sm,
    paddingVertical: 3,
    borderRadius: radios.full,
  },
  rolPillTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9a5b08',
    textTransform: 'uppercase',
  },
});