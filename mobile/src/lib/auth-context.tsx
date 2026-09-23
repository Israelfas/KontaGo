import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth as useClerkAuth } from '@clerk/expo';
import * as api from './api';
import type { RegistroInput } from './api';
import type { TokenPair } from './tipos';

const STORAGE_KEY = 'kontago.accessToken';
const REFRESH_STORAGE_KEY = 'kontago.refreshToken';

interface JwtPayload {
  sub: string;
  tenantId: string;
  rol: 'admin' | 'cajero';
  exp: number;
}

// RN/Hermes moderno trae atob global, pero no en todos los engines JS que
// puede usar Expo (JSC en algunos builds no lo expone) — decodificamos
// base64 a mano para no depender de eso.
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodificarBase64(input: string): string {
  let str = input.replace(/=+$/, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of str) {
    const val = BASE64_CHARS.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function decodificarPayload(token: string): JwtPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    return JSON.parse(decodificarBase64(payloadB64));
  } catch {
    return null;
  }
}

interface AuthContextValue {
  token: string | null;
  usuario: JwtPayload | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrarse: (dto: RegistroInput) => Promise<void>;
  loginConClerk: (clerkToken: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { signOut: cerrarSesionDeClerk } = useClerkAuth();
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Único punto que renueva la sesión: lo usa api.ts cuando recibe un
  // 401, y el arranque cuando el accessToken guardado ya venció. Devuelve
  // el accessToken nuevo, o null si no se pudo renovar.
  async function renovarSesion(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_STORAGE_KEY);
    if (!refreshToken) return null;
    try {
      const par = await api.refrescarSesion(refreshToken);
      await guardarSesion(par);
      return par.accessToken;
    } catch (err) {
      // Solo un 401 significa "refresh vencido o usuario desactivado". Un
      // corte de red no debe sacar a nadie de la sesión.
      if (err instanceof api.ApiError && err.statusCode === 401) {
        await cerrarSesion();
      }
      return null;
    }
  }

  useEffect(() => {
    api.configurarRefrescoDeSesion(renovarSesion);
    return () => api.configurarRefrescoDeSesion(null);
  }, []);

  // Al montar, recuperamos la sesión guardada. Si el accessToken ya
  // venció pero queda refreshToken, se renueva en vez de pedir login.
  // SecureStore es async incluso para leer, a diferencia de localStorage.
  useEffect(() => {
    (async () => {
      const guardado = await SecureStore.getItemAsync(STORAGE_KEY);
      const payload = guardado ? decodificarPayload(guardado) : null;
      if (guardado && payload && payload.exp * 1000 > Date.now()) {
        setToken(guardado);
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        await renovarSesion();
      }
      setCargando(false);
    })();
  }, []);

  async function guardarSesion({ accessToken, refreshToken }: TokenPair) {
    await SecureStore.setItemAsync(STORAGE_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_STORAGE_KEY, refreshToken);
    setToken(accessToken);
  }

  async function iniciarSesion(email: string, password: string) {
    await guardarSesion(await api.login(email, password));
  }

  async function registrarse(dto: RegistroInput) {
    await guardarSesion(await api.registrar(dto));
  }

  async function loginConClerk(clerkToken: string) {
    await guardarSesion(await api.loginConClerk(clerkToken));
  }

  // Cierra las DOS sesiones: si solo se borra el token de KontaGo, la
  // sesión de Clerk sigue viva y el próximo "Continuar con Google" entra
  // sin preguntar nada.
  async function cerrarSesion() {
    // También en el servidor: si no, el refreshToken guardado seguiría
    // sirviendo 7 días. Sin esperar: salir no depende de la conexión.
    const refreshToken = await SecureStore.getItemAsync(REFRESH_STORAGE_KEY);
    if (refreshToken) api.cerrarSesionEnServidor(refreshToken).catch(() => {});
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    await SecureStore.deleteItemAsync(REFRESH_STORAGE_KEY);
    setToken(null);
    try {
      await cerrarSesionDeClerk();
    } catch {
      // Si Clerk falla, igual salimos de KontaGo.
    }
  }

  const usuario = token ? decodificarPayload(token) : null;

  return (
    <AuthContext.Provider
      value={{
        token,
        usuario,
        cargando,
        iniciarSesion,
        registrarse,
        loginConClerk,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}