import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { PerfilScreen } from '../screens/PerfilScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { TerminosScreen } from '../screens/TerminosScreen';
import { ContactoScreen } from '../screens/ContactoScreen';
import { SuscripcionScreen } from '../screens/SuscripcionScreen';
import { colores } from '../theme/colores';
import type { Perfil } from '../lib/api';

export type RootStackParamList = {
  MainTabs: undefined;
  Perfil: undefined;
  Tutorial: undefined;
  Terminos: undefined;
  Contacto: undefined;
  Suscripcion: { plan: Perfil['plan'] } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { token, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.papel }}>
        <ActivityIndicator color={colores.tinta} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colores.papel },
            headerTintColor: colores.tinta,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Tu cuenta' }} />
          <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ title: 'Tutorial' }} />
          <Stack.Screen name="Terminos" component={TerminosScreen} options={{ title: 'Términos y condiciones' }} />
          <Stack.Screen name="Contacto" component={ContactoScreen} options={{ title: 'Contacto y soporte' }} />
          <Stack.Screen name="Suscripcion" component={SuscripcionScreen} options={{ title: 'Suscripción' }} />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}