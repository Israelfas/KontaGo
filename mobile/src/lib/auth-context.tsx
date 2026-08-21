import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from './api';
import type { RegistroInput } from './api';

const STORAGE_KEY = 'kontago.accessToken';

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
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, recuperamos la sesión guardada (si el token no venció).
  // SecureStore es async incluso para leer, a diferencia de localStorage.
  useEffect(() => {
    (async () => {
      const guardado = await SecureStore.getItemAsync(STORAGE_KEY);
      if (guardado) {
        const payload = decodificarPayload(guardado);
        const vigente = payload && payload.exp * 1000 > Date.now();
        if (vigente) {
          setToken(guardado);
        } else {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
        }
      }
      setCargando(false);
    })();
  }, []);

  async function guardarSesion(accessToken: string) {
    await SecureStore.setItemAsync(STORAGE_KEY, accessToken);
    setToken(accessToken);
  }

  async function iniciarSesion(email: string, password: string) {
    const { accessToken } = await api.login(email, password);
    await guardarSesion(accessToken);
  }

  async function registrarse(dto: RegistroInput) {
    const { accessToken } = await api.registrar(dto);
    await guardarSesion(accessToken);
  }

  async function cerrarSesion() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setToken(null);
  }

  const usuario = token ? decodificarPayload(token) : null;

  return (
    <AuthContext.Provider
      value={{ token, usuario, cargando, iniciarSesion, registrarse, cerrarSesion }}
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
