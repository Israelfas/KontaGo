'use client';

import { useRef, useState, type FormEvent } from 'react';
import { AlertaDeFormulario, Button } from './ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

/**
 * Segundo paso del ingreso cuando la cuenta tiene la verificación en dos
 * pasos: el código de 6 dígitos de la app autenticadora o, si se perdió el
 * celular, uno de recuperación. Con los 6 dígitos se envía solo.
 */
export function PasoCodigo({ desafio, onVolver }: { desafio: string; onVolver: () => void }) {
  const { completarConCodigo } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [deRecuperacion, setDeRecuperacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  async function enviar(valor: string) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await completarConCodigo(desafio, valor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.');
      setCodigo('');
      setEnviando(false);
      campoRef.current?.focus();
    }
  }

  function alEscribir(valor: string) {
    if (deRecuperacion) {
      setCodigo(valor.slice(0, 12));
      return;
    }
    const digitos = valor.replace(/\D/g, '').slice(0, 6);
    setCodigo(digitos);
    if (digitos.length === 6) void enviar(digitos);
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.trim()) void enviar(codigo);
  }

  const listo = deRecuperacion
    ? codigo.replace(/[^a-z0-9]/gi, '').length === 8
    : codigo.length === 6;

  return (
    <form onSubmit={alEnviar} className="app-card entra p-5 sm:p-6">
      <p className="text-sm leading-6 text-tinta-suave">
        {deRecuperacion
          ? 'Escribe uno de los códigos de recuperación que guardaste al activar la verificación. Cada uno sirve una sola vez.'
          : 'Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator…) y escribe el código de 6 dígitos de KontaGo.'}
      </p>

      <label className="field-label mt-4" htmlFor="codigo-dos-pasos">
        {deRecuperacion ? 'Código de recuperación' : 'Código de verificación'}
      </label>
      <input
        ref={campoRef}
        id="codigo-dos-pasos"
        value={codigo}
        onChange={(e) => alEscribir(e.target.value)}
        className="field text-center font-ticket text-2xl tracking-[0.35em]"
        inputMode={deRecuperacion ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoFocus
        placeholder={deRecuperacion ? 'xxxx-xxxx' : '000000'}
        aria-describedby={error ? 'codigo-error' : undefined}
        disabled={enviando}
      />

      {error && (
        <div className="mt-4" id="codigo-error">
          <AlertaDeFormulario>{error}</AlertaDeFormulario>
        </div>
      )}

      <Button type="submit" disabled={!listo || enviando} className="mt-5 w-full">
        {enviando ? 'Verificando…' : 'Verificar'}
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setDeRecuperacion((v) => !v);
            setCodigo('');
            setError(null);
            campoRef.current?.focus();
          }}
          className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4"
        >
          {deRecuperacion ? 'Usar la app autenticadora' : 'No tengo el celular'}
        </button>
        <button type="button" onClick={onVolver} className="text-tinta-suave hover:text-tinta">
          Volver
        </button>
      </div>
    </form>
  );
}
