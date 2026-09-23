'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { AlertaDeFormulario, AvisoDeCampo, Button, LoadingState } from '@/components/ui';
import { CampoContrasena, MedidorDeFuerza } from '@/components/campo-contrasena';
import { ApiError, restablecerPassword, verificarRecuperacion } from '@/lib/api';
import {
  faltanALaContrasena,
  fuerzaDeLaContrasena,
  problemaDeLaContrasena,
} from '@/lib/validacion';

type Estado = 'revisando' | 'invalido' | 'formulario';

/**
 * Llega desde el enlace del email (/restablecer?token=…). Primero se
 * revisa que el enlace sirva, así un enlace vencido lo dice de entrada y
 * no después de escribir la contraseña dos veces.
 */
export default function RestablecerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('revisando');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [salio, setSalio] = useState({ password: false, repetida: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const deLaUrl = new URLSearchParams(window.location.search).get('token');
    // El enlace no queda en la barra ni en el historial del navegador.
    window.history.replaceState(null, '', '/restablecer');
    if (!deLaUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado('invalido');
      return;
    }
    setToken(deLaUrl);
    verificarRecuperacion(deLaUrl)
      .then(() => setEstado('formulario'))
      .catch(() => setEstado('invalido'));
  }, []);

  const problemaPassword = problemaDeLaContrasena(password);
  const problemaRepetida =
    repetida && repetida !== password ? 'No coincide con la de arriba.' : null;
  const faltan = faltanALaContrasena(password);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (problemaPassword || !password || problemaRepetida || !repetida) {
      setSalio({ password: true, repetida: true });
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await restablecerPassword(token, password);
      router.replace('/login?restablecida=1');
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        /venció|ya se usó/.test(err.message)
      ) {
        setEstado('invalido');
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá tu conexión.');
      }
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recuperar el acceso"
      title={estado === 'invalido' ? 'El enlace ya no sirve' : 'Elegí una contraseña nueva'}
      description={
        estado === 'invalido'
          ? 'Los enlaces vencen a los 30 minutos y sirven una sola vez. Pedí uno nuevo: tarda un minuto.'
          : 'Al guardarla se cierra tu sesión en todos los dispositivos y te avisamos por email.'
      }
      footer={
        <Link
          href="/login"
          className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4 hover:text-ambar"
        >
          Volver a iniciar sesión
        </Link>
      }
    >
      {estado === 'revisando' && <LoadingState label="Revisando el enlace…" />}

      {estado === 'invalido' && (
        <div className="app-card entra p-5 sm:p-6">
          <Link href="/recuperar" className="button button-primary w-full">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}

      {estado === 'formulario' && (
        <form onSubmit={guardar} className="app-card entra p-5 sm:p-6" noValidate>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="nueva-password">
                Contraseña nueva
              </label>
              <CampoContrasena
                id="nueva-password"
                value={password}
                onChange={setPassword}
                onBlur={() => setSalio((s) => ({ ...s, password: true }))}
                autoComplete="new-password"
                autoFocus
                invalido={salio.password && !!problemaPassword}
                describedBy="nueva-password-aviso"
                placeholder="Una frase de al menos 8 caracteres"
              />
              <AvisoDeCampo
                id="nueva-password-aviso"
                error={salio.password ? problemaPassword : null}
                ayuda={
                  password && faltan > 0
                    ? `Faltan ${faltan} caracter${faltan === 1 ? '' : 'es'}.`
                    : 'Mejor una frase fácil de recordar que una palabra con símbolos.'
                }
              />
              {faltan === 0 && <MedidorDeFuerza {...fuerzaDeLaContrasena(password)} />}
            </div>
            <div>
              <label className="field-label" htmlFor="repetir-password">
                Repetila
              </label>
              <CampoContrasena
                id="repetir-password"
                value={repetida}
                onChange={setRepetida}
                onBlur={() => setSalio((s) => ({ ...s, repetida: true }))}
                autoComplete="new-password"
                invalido={salio.repetida && !!problemaRepetida}
                describedBy="repetir-password-aviso"
              />
              <AvisoDeCampo
                id="repetir-password-aviso"
                error={
                  salio.repetida
                    ? (problemaRepetida ??
                      (repetida ? null : 'Escribila de nuevo para confirmarla.'))
                    : null
                }
                ayuda={repetida && !problemaRepetida && !problemaPassword ? 'Coinciden.' : null}
              />
            </div>
          </div>
          {error && (
            <div className="mt-4">
              <AlertaDeFormulario>{error}</AlertaDeFormulario>
            </div>
          )}
          <Button type="submit" disabled={enviando} className="mt-5 w-full">
            {enviando ? 'Guardando…' : 'Guardar y entrar'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
