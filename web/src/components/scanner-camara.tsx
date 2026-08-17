'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import type { IScannerControls } from '@zxing/browser';

interface ScannerCamaraProps {
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
  // Nombre del último producto agregado (o null). Cuando cambia, mostramos
  // un destello de confirmación — es la única señal visible de que el
  // escaneo funcionó, ya que la cámara se queda abierta para el siguiente.
  confirmacion: string | null;
}

// Evita que sostener el producto frente a la cámara un instante de más
// cuente como 5 escaneos del mismo código en fracciones de segundo.
const COOLDOWN_MISMO_CODIGO_MS = 2000;

// Windows a veces tarda una fracción de segundo en liberar la cámara del
// intento anterior (más notorio en desarrollo, donde React monta el
// componente dos veces a propósito). Reintentamos antes de rendirnos.
const REINTENTOS = 3;
const ESPERA_ENTRE_REINTENTOS_MS = 400;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ScannerCamara({ onDetectado, onCerrar, confirmacion }: ScannerCamaraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const ultimoDetectadoRef = useRef<{ codigo: string; en: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      // TRY_HARDER: análisis más exhaustivo por cuadro (más costo de CPU,
      // pero mucho más tolerante a códigos borrosos, en ángulo, o leídos
      // desde la pantalla de otro dispositivo en vez de papel impreso).
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      let cancelado = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      function manejarDeteccion(resultado: { getText(): string } | undefined) {
      if (cancelado || !resultado) return;

      const codigo = resultado.getText();
      const ahora = Date.now();
      const ultimo = ultimoDetectadoRef.current;

      if (ultimo && ultimo.codigo === codigo && ahora - ultimo.en < COOLDOWN_MISMO_CODIGO_MS) {
        return; // mismo código detectado hace menos de 2s, ignorar
      }

      ultimoDetectadoRef.current = { codigo, en: ahora };
      onDetectado(codigo);
    }

    async function iniciarConReintentos() {
      // Primero intentamos la cámara trasera (lo normal en un celular).
      // Si el dispositivo no tiene ("OverconstrainedError", típico en
      // notebooks) o si falla por la cámara todavía ocupada del montaje
      // anterior, reintentamos con cualquier cámara disponible.
      const intentos: MediaStreamConstraints[] = [
        { video: { facingMode: 'environment' } },
        { video: true },
      ];

      let ultimoError: unknown = null;

      for (const constraints of intentos) {
        for (let intento = 0; intento < REINTENTOS; intento++) {
          if (cancelado) return;
          try {
            const controls = await reader.decodeFromConstraints(
              constraints,
              videoRef.current!,
              manejarDeteccion,
            );
            if (cancelado) {
              controls.stop();
            } else {
              controlsRef.current = controls;
            }
            return; // éxito, no seguimos intentando
          } catch (err) {
            ultimoError = err;
            await esperar(ESPERA_ENTRE_REINTENTOS_MS);
          }
        }
      }

      if (cancelado) return;

      const err = ultimoError;
      const nombre = err instanceof Error ? err.name : 'desconocido';
      const mensaje =
        nombre === 'NotAllowedError'
          ? 'No se pudo acceder a la cámara. Revisá los permisos del navegador.'
          : nombre === 'NotFoundError'
            ? 'No se encontró ninguna cámara en este dispositivo.'
            : nombre === 'NotReadableError'
              ? 'La cámara está siendo usada por otra aplicación o pestaña. Cerrala e intentá de nuevo.'
              : `No se pudo iniciar la cámara (${nombre}).`;
      setError(mensaje);
    }

    // Retrasamos el arranque real un instante: en desarrollo, React monta
    // el componente dos veces seguidas (a propósito, para detectar efectos
    // no idempotentes). Sin este retraso, ambas invocaciones piden la
    // cámara casi al mismo tiempo y compiten por el mismo <video>,
    // dejando la imagen negra (el error típico es "play() interrupted by
    // a new load request"). Con este pequeño delay, el cleanup de la
    // primera invocación cancela el arranque antes de que llegue a pedir
    // la cámara, y solo la invocación final la pide de verdad.
    timeoutId = setTimeout(() => {
      if (!cancelado) iniciarConReintentos();
    }, 50);

    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe iniciar/detener la cámara al montar/desmontar
  }, []);

  return (
    <div className="rounded-lg border border-papel-linea bg-tinta p-3">
      {error ? (
        <p className="px-2 py-6 text-center text-sm text-papel">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-md">
          {/* Video de cámara en vivo, sin pista de audio que subtitular */}
          <video ref={videoRef} className="w-full rounded-md" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-ambar/80" />

          {confirmacion && (
            <div
              key={confirmacion}
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-verde-ganancia/80 animate-[destello_1.2s_ease-out]"
            >
              <span className="rounded-md bg-tinta/80 px-4 py-2 text-center font-medium text-papel">
                ✓ {confirmacion} agregado
              </span>
            </div>
          )}
        </div>
      )}
      <button
        onClick={onCerrar}
        className="mt-3 w-full rounded-md border border-papel/30 py-2 text-sm text-papel transition-colors hover:bg-papel/10"
      >
        Cerrar cámara
      </button>
    </div>
  );
}