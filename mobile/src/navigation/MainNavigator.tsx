import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
      <Tab.Screen name="Resumen" component={DashboardScreen} />
      <Tab.Screen name="Productos" component={ProductosScreen} />
      <Tab.Screen name="Inventario" component={InventarioScreen} />
    </Tab.Navigator>
  );
}