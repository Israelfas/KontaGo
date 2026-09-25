'use client';

import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { AlertaDeFormulario, Button, LoadingState } from './ui';
import { VentanaPie, useVentana } from './ventana';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  activarDosPasos,
  desactivarDosPasos,
  iniciarDosPasos,
  obtenerDosPasos,
  type EstadoDosPasos,
} from '@/lib/api';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Activar o desactivar la verificación en dos pasos (va en una Ventana).
 * Activar: se escanea el QR con la app autenticadora, se confirma con un
 * código y se guardan los códigos de recuperación (se ven una sola vez).
 */
export function ConfiguracionDosPasos() {
  const { token } = useAuth();
  const { cerrar } = useVentana();
  const [estado, setEstado] = useState<EstadoDosPasos | null>(null);
  const [configurando, setConfigurando] = useState<{ secreto: string; qr: string } | null>(null);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!token) return;
    obtenerDosPasos(token)
      .then(setEstado)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar.'));
  }, [token]);

  const fallo = (err: unknown, porDefecto: string) =>
    setError(err instanceof ApiError ? err.message : porDefecto);

  async function empezar() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      const { secreto, enlace } = await iniciarDosPasos(token);
      const qr = await QRCode.toString(enlace, {
        type: 'svg',
        margin: 1,
        color: { dark: '#1c2b3a', light: '#ffffff' },
      });
      setConfigurando({ secreto, qr });
    } catch (err) {
      fallo(err, 'No se pudo empezar. Prueba de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!token || codigo.length !== 6) return;
    setError(null);
    setEnviando(true);
    try {
      const { codigosRecuperacion } = await activarDosPasos(token, codigo);
      setCodigos(codigosRecuperacion);
      setConfigurando(null);
      setCodigo('');
    } catch (err) {
      fallo(err, 'No se pudo activar.');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  async function desactivar(evento: FormEvent) {
    evento.preventDefault();
    if (!token || !codigo.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      await desactivarDosPasos(token, codigo);
      setEstado({ activa: false, desde: null, codigosRestantes: 0 });
      setCodigo('');
    } catch (err) {
      fallo(err, 'No se pudo desactivar.');
    } finally {
      setEnviando(false);
    }
  }

  function copiarCodigos() {
    if (!codigos) return;
    void navigator.clipboard?.writeText(codigos.join('\n')).then(() => setCopiado(true));
  }

  function descargarCodigos() {
    if (!codigos) return;
    const texto = `Códigos de recuperación de KontaGo\nCada uno sirve una sola vez para entrar si no tienes el celular.\n\n${codigos.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'kontago-codigos-de-recuperacion.txt';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const campoCodigo = (id: string, etiqueta: string, soloDigitos: boolean) => (
    <div>
      <label className="field-label" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        value={codigo}
        onChange={(e) =>
          setCodigo(
            soloDigitos
              ? e.target.value.replace(/\D/g, '').slice(0, 6)
              : e.target.value.slice(0, 12),
          )
        }
        className="field text-center font-ticket text-xl tracking-[0.3em]"
        inputMode={soloDigitos ? 'numeric' : 'text'}
        autoComplete="one-time-code"
        placeholder={soloDigitos ? '000000' : '000000 o xxxx-xxxx'}
        autoFocus
      />
    </div>
  );

  const alerta = error && (
    <div className="mt-4">
      <AlertaDeFormulario>{error}</AlertaDeFormulario>
    </div>
  );

  // 3. Recién activada: los códigos de recuperación, una sola vez.
  if (codigos) {
    return (
      <div>
        <p className="rounded-xl border border-verde-ganancia/25 bg-verde-ganancia/[0.07] px-3.5 py-3 text-sm text-verde-ganancia">
          Listo: desde ahora, al entrar se te pide también el código de la app.
        </p>
        <p className="mt-4 text-sm leading-6 text-tinta">
          <strong>Guarda estos códigos</strong> en un lugar seguro (anotados en papel, o en tu
          correo). Si pierdes el celular, cada uno te deja entrar una vez.{' '}
          <strong>No se vuelven a mostrar.</strong>
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-papel-linea bg-papel p-3 font-ticket text-base">
          {codigos.map((c) => (
            <li key={c} className="text-center tracking-wider text-tinta">
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copiarCodigos}>
            {copiado ? 'Copiados' : 'Copiar'}
          </Button>
          <Button type="button" variant="secondary" onClick={descargarCodigos}>
            Descargar
          </Button>
        </div>
        <VentanaPie>
          <Button type="button" onClick={cerrar}>
            Ya los guardé
          </Button>
        </VentanaPie>
      </div>
    );
  }

  // 2. Escanear y confirmar.
  if (configurando) {
    return (
      <form onSubmit={confirmar}>
        <ol className="space-y-1.5 text-sm leading-6 text-tinta">
          <li>
            1. Instala una app autenticadora en tu celular: Google Authenticator o Microsoft
            Authenticator (son gratis).
          </li>
          <li>2. En la app, toca “+” y escanea este código.</li>
          <li>3. Escribe abajo el código de 6 dígitos que aparece.</li>
        </ol>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <span
            className="block h-44 w-44 shrink-0 overflow-hidden rounded-xl border border-papel-linea bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label="Código QR para la app autenticadora"
            dangerouslySetInnerHTML={{ __html: configurando.qr }}
          />
          <div className="text-sm text-tinta-suave">
            <p>¿No puedes escanear? Escribe esta clave en la app:</p>
            <p className="mt-1.5 select-all break-all rounded-lg bg-papel px-2.5 py-2 font-ticket text-sm tracking-wider text-tinta">
              {configurando.secreto}
            </p>
          </div>
        </div>
        <div className="mt-4">{campoCodigo('codigo-activar', 'Código de la app', true)}</div>
        {alerta}
        <VentanaPie>
          <Button type="submit" disabled={codigo.length !== 6 || enviando}>
            {enviando ? 'Activando…' : 'Activar'}
          </Button>
          <Button type="button" variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
        </VentanaPie>
      </form>
    );
  }

  if (!estado) {
    return error ? (
      <p className="pb-5 text-sm text-rojo-perdida">{error}</p>
    ) : (
      <LoadingState label="Cargando…" />
    );
  }

  // Activada: se puede desactivar con un código.
  if (estado.activa) {
    return (
      <form onSubmit={desactivar}>
        <p className="rounded-xl border border-verde-ganancia/25 bg-verde-ganancia/[0.07] px-3.5 py-3 text-sm text-verde-ganancia">
          Activada{estado.desde ? ` desde el ${fecha(estado.desde)}` : ''}. Te quedan{' '}
          {estado.codigosRestantes} código{estado.codigosRestantes === 1 ? '' : 's'} de recuperación
          sin usar.
        </p>
        <p className="mt-4 text-sm leading-6 text-tinta-suave">
          Para desactivarla, escribe un código de la app (o uno de recuperación). Sin ella, a tu
          cuenta se entra solo con la contraseña.
        </p>
        <div className="mt-4">{campoCodigo('codigo-desactivar', 'Código', false)}</div>
        {alerta}
        <VentanaPie>
          <Button type="submit" variant="danger" disabled={!codigo.trim() || enviando}>
            {enviando ? 'Desactivando…' : 'Desactivar'}
          </Button>
          <Button type="button" variant="ghost" onClick={cerrar}>
            Cerrar
          </Button>
        </VentanaPie>
      </form>
    );
  }

  // 1. Todavía no la usa.
  return (
    <div>
      <p className="text-sm leading-6 text-tinta">
        Además de la contraseña, al entrar se te pide un código de 6 dígitos que cambia cada 30
        segundos en una app de tu celular. Así, aunque alguien sepa tu contraseña, no puede entrar
        sin tu celular.
      </p>
      <p className="mt-3 text-sm leading-6 text-tinta-suave">
        Recomendada para el administrador: es quien ve las ganancias y maneja el equipo.
      </p>
      {alerta}
      <VentanaPie>
        <Button type="button" onClick={empezar} disabled={enviando}>
          {enviando ? 'Preparando…' : 'Activar'}
        </Button>
        <Button type="button" variant="ghost" onClick={cerrar}>
          Ahora no
        </Button>
      </VentanaPie>
    </div>
  );
}
