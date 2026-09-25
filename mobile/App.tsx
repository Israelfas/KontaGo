import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { AuthProvider } from './src/lib/auth-context';
import { SinConexionProvider } from './src/lib/sin-conexion';
import { RootNavigator } from './src/navigation/RootNavigator';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function App() {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AuthProvider>
          {/* Vender sin internet: la cola de ventas y el catálogo guardado. */}
          <SinConexionProvider>
            <RootNavigator />
          </SinConexionProvider>
        </AuthProvider>
      </ClerkProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}