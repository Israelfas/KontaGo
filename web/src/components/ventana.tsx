'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CloseIcon } from './icons';

// Lo que tarda en irse (ver .ventana[data-saliendo] en globals.css).
const SALIDA_MS = 200;

const ContextoVentana = createContext<{ cerrar: () => void }>({ cerrar: () => {} });

/** Para que un formulario adentro cierre la ventana (con su animación) al terminar. */
export const useVentana = () => useContext(ContextoVentana);

/**
 * Una ventana para editar o registrar algo sin perder de vista la pantalla
 * de fondo. En escritorio es un panel centrado que aparece con una leve
 * escala; en el celular, una hoja que sube desde abajo. Se cierra con Esc,
 * tocando afuera o con la X, y se va por el mismo camino por el que vino.
 *
 * Es un <dialog> nativo abierto con showModal(): el fondo queda inerte, el
 * foco no se escapa y el lector de pantalla la anuncia como diálogo.
 *
 * Se muestra mientras está montada: `{editando && <Ventana …/>}`.
 */
export function Ventana({
  titulo,
  descripcion,
  icono,
  tono = 'neutro',
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  icono?: ReactNode;
  tono?: 'neutro' | 'verde' | 'rojo';
  onCerrar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saliendo, setSaliendo] = useState(false);
  const cerrando = useRef(false);
  const idTitulo = useId();
  const idDescripcion = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  const cerrar = useCallback(() => {
    if (cerrando.current) return;
    cerrando.current = true;
    const terminar = () => {
      ref.current?.close();
      onCerrar();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      terminar();
      return;
    }
    setSaliendo(true);
    window.setTimeout(terminar, SALIDA_MS);
  }, [onCerrar]);

  return (
    <dialog
      ref={ref}
      className="ventana"
      data-saliendo={saliendo || undefined}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      // Esc: que se vaya animada, no de golpe.
      onCancel={(e) => {
        e.preventDefault();
        cerrar();
      }}
    >
      {/* Tocar afuera del panel la cierra. Con mousedown (no click): si
          alguien selecciona texto adentro y suelta afuera, no se cierra. */}
      <div
        className="ventana-fondo"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) cerrar();
        }}
      >
        <div className="ventana-panel">
          <span className="ventana-agarre" aria-hidden="true" />
          <header className="ventana-cabecera">
            {icono && <span className={`ventana-icono ventana-icono-${tono}`}>{icono}</span>}
            <div className="min-w-0 flex-1">
              <h2 id={idTitulo} className="ventana-titulo">
                {titulo}
              </h2>
              {descripcion && (
                <p id={idDescripcion} className="ventana-descripcion">
                  {descripcion}
                </p>
              )}
            </div>
            <button type="button" onClick={cerrar} className="ventana-cerrar" aria-label="Cerrar">
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>
          <div className="ventana-cuerpo">
            <ContextoVentana.Provider value={{ cerrar }}>{children}</ContextoVentana.Provider>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Los botones de la ventana: quedan pegados abajo aunque el contenido sea largo. */
export function VentanaPie({ children }: { children: ReactNode }) {
  return <div className="ventana-pie">{children}</div>;
}
