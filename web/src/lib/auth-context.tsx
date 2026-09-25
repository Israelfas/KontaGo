'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import * as api from './api';
import type { RegistroInput, SesionWeb } from './api';

// Dónde se guardaba la sesión antes de la cookie. Si quedó algo, se canjea
// una vez por la cookie y se borra: nadie tiene que volver a entrar.
const CLAVES_VIEJAS = ['kontago.accessToken', 'kontago.refreshToken'];

function tokenViejo(): string | null {
  try {
    return localStorage.getItem('kontago.refreshToken');
  } catch {
    return null;
  }
}

function borrarTokensViejos() {
  try {
    CLAVES_VIEJAS.forEach((clave) => localStorage.removeItem(clave));
  } catch {
    // Sin acceso al almacenamiento: no hay nada que borrar.
  }
}

// Una sola renovación a la vez (varias pantallas con 401, el doble montaje
// de React en desarrollo): dos con la misma cookie parecerían un token
// robado y reusado.
let renovacionEnCurso: Promise<string | null> | null = null;

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
  // Devuelven el desafío si la cuenta pide el código de dos pasos (null
  // si ya entró).
  iniciarSesion: (email: string, password: string) => Promise<api.DesafioDosPasos | null>;
  completarLoginConClerk: (clerkToken: string) => Promise<api.DesafioDosPasos | null>;
  completarConCodigo: (desafio: string, codigo: string) => Promise<void>;
  registrarse: (dto: RegistroInput) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const { signOut: cerrarSesionDeClerk } = useClerkAuth();

  /*
   * La sesión de la web: el token de acceso (15 min) vive solo en memoria;
   * el de renovación, en una cookie httpOnly que ningún script puede leer
   * (ni uno inyectado por un ataque). Al abrir la página no hay token en
   * memoria: se renueva con la cookie.
   */

  // Único punto que renueva la sesión: lo usa api.ts cuando recibe un
  // 401, y el arranque. Devuelve el accessToken nuevo, o null si no se
  // pudo renovar.
  function renovarSesion(): Promise<string | null> {
    if (!renovacionEnCurso) {
      renovacionEnCurso = (async () => {
        try {
          const { accessToken } = await api.refrescarSesion(tokenViejo() ?? undefined);
          borrarTokensViejos();
          setToken(accessToken);
          return accessToken;
        } catch (err) {
          // Solo un 401 significa "sesión vencida o usuario desactivado". Un
          // corte de red no debe sacar a nadie de la sesión.
          // Sin redirigir: RutaProtegida ya manda a /login si hace falta, y
          // así una página pública no expulsa a nadie.
          if (err instanceof api.ApiError && err.statusCode === 401) {
            borrarTokensViejos();
            setToken(null);
          }
          return null;
        }
      })().finally(() => {
        renovacionEnCurso = null;
      });
    }
    return renovacionEnCurso;
  }

  useEffect(() => {
    api.configurarRefrescoDeSesion(renovarSesion);
    return () => api.configurarRefrescoDeSesion(null);
  }, []);

  // Al montar: la sesión sale de la cookie (el servidor la lee; acá no se
  // puede). Es "sincronizar estado inicial desde un sistema externo".
  useEffect(() => {
    renovarSesion().finally(() => setCargando(false));
  }, []);

  function entrar({ accessToken }: SesionWeb) {
    borrarTokensViejos();
    setToken(accessToken);
    router.push(rutaInicial(decodificarPayload(accessToken)?.rol));
  }

  async function iniciarSesion(email: string, password: string) {
    const respuesta = await api.login(email, password);
    if (api.pideCodigo(respuesta)) return respuesta;
    entrar(respuesta);
    return null;
  }

  // Segundo paso, si la cuenta tiene la verificación en dos pasos.
  async function completarConCodigo(desafio: string, codigo: string) {
    entrar(await api.ingresarConCodigo(desafio, codigo));
  }

  // Puente con Clerk: Clerk ya autenticó a la persona (Google, etc.) del
  // lado del cliente. Acá se manda su token de sesión de Clerk al
  // backend, que devuelve el MISMO tipo de token que iniciarSesion() —
  // de ahí en más es indistinguible de un login normal con contraseña.
  async function completarLoginConClerk(clerkToken: string) {
    const respuesta = await api.loginConClerk(clerkToken);
    if (api.pideCodigo(respuesta)) return respuesta;
    entrar(respuesta);
    return null;
  }

  async function registrarse(dto: RegistroInput) {
    // Quien se registra siempre es el admin de la tienda nueva.
    const { accessToken } = await api.registrar(dto);
    borrarTokensViejos();
    setToken(accessToken);
    router.push('/dashboard');
  }

  // Cierra las DOS sesiones. Antes solo borraba el token de KontaGo, así
  // que la sesión de Clerk seguía viva: al tocar "Continuar con Google"
  // otra vez, entraba de una sin preguntar nada.
  async function cerrarSesion() {
    // También en el servidor (y borra la cookie): si no, la sesión
    // seguiría sirviendo 7 días. Sin esperar: salir no depende de la red.
    api.cerrarSesionEnServidor().catch(() => {});
    borrarTokensViejos();
    setToken(null);
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
      value={{
        token,
        usuario,
        cargando,
        iniciarSesion,
        completarLoginConClerk,
        completarConCodigo,
        registrarse,
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
