'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
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

// El cajero no tiene acceso al resumen (ganancias), así que entra
// directo a vender.
export function rutaInicial(rol: JwtPayload['rol'] | undefined): string {
  return rol === 'cajero' ? '/venta' : '/dashboard';
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
  completarLoginConClerk: (clerkToken: string) => Promise<void>;
  registrarse: (dto: RegistroInput) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const { signOut: cerrarSesionDeClerk } = useClerkAuth();

  // Único punto que renueva la sesión: lo usa api.ts cuando recibe un
  // 401, y el arranque cuando el accessToken guardado ya venció. Devuelve
  // el accessToken nuevo, o null si no se pudo renovar.
  async function renovarSesion(): Promise<string | null> {
    const refreshToken = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) return null;
    try {
      const par = await api.refrescarSesion(refreshToken);
      guardarSesion(par);
      return par.accessToken;
    } catch (err) {
      // Solo un 401 significa "refresh vencido o usuario desactivado". Un
      // corte de red no debe sacar a nadie de la sesión.
      // Sin redirigir: RutaProtegida ya manda a /login si hace falta, y
      // así una página pública no expulsa a nadie.
      if (err instanceof api.ApiError && err.statusCode === 401) {
        limpiarSesion();
      }
      return null;
    }
  }

  useEffect(() => {
    api.configurarRefrescoDeSesion(renovarSesion);
    return () => api.configurarRefrescoDeSesion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al montar, recuperamos la sesión guardada. Si el accessToken ya
  // venció pero queda refreshToken, se renueva en vez de pedir login.
  // localStorage no existe en el servidor, así que esto solo puede
  // resolverse en un efecto — es el caso legítimo de "sincronizar estado
  // inicial desde un sistema externo" que React recomienda.
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    const payload = guardado ? decodificarPayload(guardado) : null;
    if (guardado && payload && payload.exp * 1000 > Date.now()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(guardado);
      setCargando(false);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    renovarSesion().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function guardarSesion({ accessToken, refreshToken }: TokenPair) {
    localStorage.setItem(STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    setToken(accessToken);
  }

  async function iniciarSesion(email: string, password: string) {
    const par = await api.login(email, password);
    guardarSesion(par);
    router.push(rutaInicial(decodificarPayload(par.accessToken)?.rol));
  }

  // Puente con Clerk: Clerk ya autenticó a la persona (Google, etc.) del
  // lado del cliente. Acá se manda su token de sesión de Clerk al
  // backend, que devuelve el MISMO tipo de token que iniciarSesion() —
  // de ahí en más es indistinguible de un login normal con contraseña.
  async function completarLoginConClerk(clerkToken: string) {
    const par = await api.loginConClerk(clerkToken);
    guardarSesion(par);
    router.push(rutaInicial(decodificarPayload(par.accessToken)?.rol));
  }

  async function registrarse(dto: RegistroInput) {
    // Quien se registra siempre es el admin de la tienda nueva.
    guardarSesion(await api.registrar(dto));
    router.push('/dashboard');
  }

  function limpiarSesion() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    setToken(null);
  }

  // Cierra las DOS sesiones. Antes solo borraba el token de KontaGo, así
  // que la sesión de Clerk seguía viva: al tocar "Continuar con Google"
  // otra vez, entraba de una sin preguntar nada.
  async function cerrarSesion() {
    limpiarSesion();
    try {
      await cerrarSesionDeClerk();
    } catch {
      // Si Clerk no está disponible, igual salimos de KontaGo.
    }
    router.push('/login');
  }

  const usuario = token ? decodificarPayload(token) : null;

  return (
    <AuthContext.Provider
      value={{ token, usuario, cargando, iniciarSesion, completarLoginConClerk, registrarse, cerrarSesion }}
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