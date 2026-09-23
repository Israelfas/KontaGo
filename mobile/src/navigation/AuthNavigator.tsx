import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegistroScreen } from '../screens/RegistroScreen';
import { RecuperarScreen } from '../screens/RecuperarScreen';

export type AuthStackParamList = {
  Login: undefined;
  Registro: undefined;
  // Con el email ya escrito en el login, si lo había.
  Recuperar: { email?: string } | undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Registro" component={RegistroScreen} />
      <Stack.Screen name="Recuperar" component={RecuperarScreen} />
    </Stack.Navigator>
  );
}
