'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import * as api from './api';
import type { RegistroInput } from './api';

const STORAGE_KEY = 'kontago.accessToken';

interface JwtPayload {
  sub: string;
  tenantId: string;
  rol: 'admin' | 'cajero';
  exp: number;
}

function decodificarPayload(token: string): JwtPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    return JSON.parse(atob(payloadB64));
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
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  // Al montar, recuperamos la sesión guardada (si el token no venció).
  // localStorage no existe en el servidor, así que esto solo puede
  // resolverse en un efecto — es el caso legítimo de "sincronizar estado
  // inicial desde un sistema externo" que React recomienda.
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) {
      const payload = decodificarPayload(guardado);
      const vigente = payload && payload.exp * 1000 > Date.now();
      if (vigente) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(guardado);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setCargando(false);
  }, []);

  function guardarSesion(accessToken: string) {
    localStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);
  }

  async function iniciarSesion(email: string, password: string) {
    const { accessToken } = await api.login(email, password);
    guardarSesion(accessToken);
    router.push('/dashboard');
  }

  async function registrarse(dto: RegistroInput) {
    const { accessToken } = await api.registrar(dto);
    guardarSesion(accessToken);
    router.push('/dashboard');
  }

  function cerrarSesion() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    router.push('/login');
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
