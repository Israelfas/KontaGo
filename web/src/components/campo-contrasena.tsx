'use client';

import { useState, type KeyboardEvent } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

/**
 * Campo de contraseña con dos ayudas que evitan la mayoría de los
 * "contraseña incorrecta":
 * - un botón para verla (en el celular se tipea a ciegas);
 * - un aviso si están activadas las mayúsculas.
 */
export function CampoContrasena({
  id,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  invalido,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  invalido?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const revisarMayusculas = (e: KeyboardEvent<HTMLInputElement>) =>
    setMayusculas(e.getModifierState('CapsLock'));

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={revisarMayusculas}
          onKeyUp={revisarMayusculas}
          onBlur={() => {
            setMayusculas(false);
            onBlur?.();
          }}
          aria-invalid={invalido || undefined}
          aria-describedby={describedBy}
          className="field !pr-12"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[0.7rem] text-tinta-suave transition-colors hover:text-tinta"
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
      {mayusculas && (
        <p className="aviso-advertencia mt-1 text-xs" role="status">
          Tenés las mayúsculas activadas.
        </p>
      )}
    </div>
  );
}

/** Barrita de fuerza de una contraseña nueva. */
export function MedidorDeFuerza({ nivel, texto }: { nivel: 0 | 1 | 2 | 3; texto: string }) {
  if (nivel === 0) return null;
  const color = nivel === 1 ? 'bg-rojo-perdida' : nivel === 2 ? 'bg-ambar' : 'bg-verde-ganancia';
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              n <= nivel ? color : 'bg-papel-linea'
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-tinta-suave">Seguridad: {texto}</p>
    </div>
  );
}
