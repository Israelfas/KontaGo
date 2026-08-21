import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { VentaScreen } from '../screens/VentaScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductosScreen } from '../screens/ProductosScreen';
import { InventarioScreen } from '../screens/InventarioScreen';
import { colores } from '../theme/colores';

export type MainTabParamList = {
  Vender: undefined;
  Resumen: undefined;
  Productos: undefined;
  Inventario: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Iconos con emoji simple en vez de una librería de íconos extra — mantiene
// el bundle liviano; se puede reemplazar por @expo/vector-icons más
// adelante si se quiere paridad visual exacta con el ícono set del web.
const ICONOS: Record<keyof MainTabParamList, string> = {
  Vender: '🛒',
  Resumen: '📊',
  Productos: '📦',
  Inventario: '📋',
};

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colores.tinta,
        tabBarInactiveTintColor: colores.tintaSuave,
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopColor: colores.papelLinea,
        },
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONOS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Vender" component={VentaScreen} />
      <Tab.Screen name="Resumen" component={DashboardScreen} />
      <Tab.Screen name="Productos" component={ProductosScreen} />
      <Tab.Screen name="Inventario" component={InventarioScreen} />
    </Tab.Navigator>
  );
}
