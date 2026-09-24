'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent as EventoPuntero,
  type ReactNode,
} from 'react';
import { ArrowRightIcon } from '../icons';
import { CON_IMPULSO, SIN_REBOTE, avanzar, elastico, proyectar, type Resorte } from './resorte';

export interface Diapositiva {
  id: string;
  etiqueta: string;
  contenido: ReactNode;
}

/** Cuánto hay que mover el dedo antes de decidir si es arrastre o scroll. */
const UMBRAL_PX = 8;
/** Velocidad (px/s) a partir de la cual el soltar cuenta como un tirón. */
const TIRON_PX_S = 350;

const CONSULTA_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

function prefiereMenosMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia(CONSULTA_MOVIMIENTO).matches;
}

/** Sigue la preferencia en vivo. En el servidor, "sí": nada arranca solo antes de hidratar. */
export function usePrefiereMenosMovimiento() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(CONSULTA_MOVIMIENTO);
      consulta.addEventListener('change', avisar);
      return () => consulta.removeEventListener('change', avisar);
    },
    prefiereMenosMovimiento,
    () => true,
  );
}

/**
 * El carrusel del producto. Se arrastra con el dedo o el mouse y sigue 1:1
 * desde donde se lo agarró; se puede agarrar en pleno movimiento; al
 * soltar sigue con la velocidad del gesto y elige la diapositiva según
 * hacia dónde iba, no según dónde quedó. Pasa solo cada tanto hasta que
 * la persona lo toca (a partir de ahí manda ella).
 */
export function Carrusel({
  diapositivas,
  etiqueta,
  intervaloMs = 7000,
}: {
  diapositivas: Diapositiva[];
  etiqueta: string;
  intervaloMs?: number;
}) {
  const total = diapositivas.length;
  const raizRef = useRef<HTMLDivElement>(null);
  const ventanaRef = useRef<HTMLDivElement>(null);
  const pistaRef = useRef<HTMLDivElement>(null);
  const pestanasRef = useRef<(HTMLButtonElement | null)[]>([]);
  const indicadorRef = useRef<HTMLSpanElement>(null);

  const [activa, setActiva] = useState(0);
  const [cercana, setCercana] = useState(0);
  const [tomoElControl, setTomoElControl] = useState(false);
  const [enPausa, setEnPausa] = useState(false);
  const [aLaVista, setALaVista] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  // Lo que cambia en cada cuadro vive en refs: no pasa por React.
  const fisica = useRef({
    x: 0,
    v: 0,
    destino: 0,
    paso: 1,
    resorte: SIN_REBOTE as Resorte,
    cuadro: 0,
    animando: false,
    activa: 0,
    cercana: 0,
  });
  const gesto = useRef<{
    puntero: number;
    inicioX: number;
    inicioY: number;
    xInicial: number;
    indiceInicial: number;
    direccion: 'h' | 'v' | null;
    historial: { x: number; t: number }[];
  } | null>(null);
  const huboArrastre = useRef(false);

  /** Pinta la pista y lleva la pastilla de las pestañas al mismo ritmo. */
  const pintar = useCallback(() => {
    const f = fisica.current;
    if (pistaRef.current) pistaRef.current.style.transform = `translate3d(${f.x}px, 0, 0)`;

    const progreso = Math.min(Math.max(-f.x / f.paso, 0), total - 1);
    const i = Math.min(Math.floor(progreso), total - 2);
    const t = progreso - Math.max(i, 0);
    const a = pestanasRef.current[Math.max(i, 0)];
    const b = pestanasRef.current[Math.max(i, 0) + 1] ?? a;
    if (a && b && indicadorRef.current) {
      const izquierda = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t;
      const ancho = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * t;
      indicadorRef.current.style.transform = `translateX(${izquierda}px)`;
      indicadorRef.current.style.width = `${ancho}px`;
    }
    const redondeada = Math.round(progreso);
    if (redondeada !== f.cercana) {
      f.cercana = redondeada;
      setCercana(redondeada);
    }
  }, [total]);

  const detener = () => {
    const f = fisica.current;
    cancelAnimationFrame(f.cuadro);
    f.animando = false;
  };

  /** Lleva el carrusel a una diapositiva con un resorte (o directo). */
  const irA = useCallback(
    (indice: number, opciones: { velocidad?: number; resorte?: Resorte } = {}) => {
      const f = fisica.current;
      const destino = (indice + total) % total;
      f.activa = destino;
      setActiva(destino);
      f.destino = -destino * f.paso;
      f.resorte = opciones.resorte ?? SIN_REBOTE;
      if (opciones.velocidad !== undefined) f.v = opciones.velocidad;

      if (prefiereMenosMovimiento()) {
        detener();
        f.x = f.destino;
        f.v = 0;
        pintar();
        return;
      }
      if (f.animando) return; // ya hay un resorte andando: solo cambió el destino
      f.animando = true;
      let anterior = performance.now();
      const cuadro = (ahora: number) => {
        const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
        anterior = ahora;
        [f.x, f.v] = avanzar(f.x, f.v, f.destino, f.resorte, dt);
        if (Math.abs(f.x - f.destino) < 0.4 && Math.abs(f.v) < 8) {
          f.x = f.destino;
          f.v = 0;
          f.animando = false;
          pintar();
          return;
        }
        pintar();
        f.cuadro = requestAnimationFrame(cuadro);
      };
      f.cuadro = requestAnimationFrame(cuadro);
    },
    [pintar, total],
  );

  // Medidas: cuánto se corre la pista por diapositiva. Se recalcula al
  // cambiar el ancho y se reacomoda sin animar.
  useEffect(() => {
    const ventana = ventanaRef.current;
    const pista = pistaRef.current;
    if (!ventana || !pista) return;
    const medir = () => {
      const [primera, segunda] = Array.from(pista.children) as HTMLElement[];
      const f = fisica.current;
      f.paso = segunda ? segunda.offsetLeft - primera.offsetLeft : primera.offsetWidth;
      detener();
      f.x = f.destino = -f.activa * f.paso;
      f.v = 0;
      pintar();
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(ventana);
    return () => {
      observador.disconnect();
      detener();
    };
  }, [pintar]);

  // Pasa solo mientras se ve en pantalla, nadie lo tocó y no se pidió
  // menos movimiento.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const observador = new IntersectionObserver(([e]) => setALaVista(e.isIntersecting), {
      threshold: 0.35,
    });
    observador.observe(raiz);
    return () => observador.disconnect();
  }, []);

  // En pantallas chicas las pestañas se desplazan: la activa, siempre a la vista.
  useEffect(() => {
    const pestana = pestanasRef.current[activa];
    const fila = pestana?.parentElement;
    if (!pestana || !fila || fila.scrollWidth <= fila.clientWidth) return;
    fila.scrollTo({
      left: pestana.offsetLeft - (fila.clientWidth - pestana.offsetWidth) / 2,
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
    });
  }, [activa]);

  // Con menos movimiento no pasa sola.
  const menosMovimiento = usePrefiereMenosMovimiento();

  // La barrita de tiempo es el reloj: al pausarse (mouse encima, foco,
  // fuera de pantalla) se detiene donde está y sigue desde ahí.
  const autoavance = !tomoElControl && !enPausa && aLaVista && !arrastrando;

  function elegir(indice: number) {
    setTomoElControl(true);
    irA(indice);
  }

  // --- Arrastre ---

  function alApoyar(e: EventoPuntero<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const f = fisica.current;
    // Se agarra desde donde está AHORA (aunque esté en pleno movimiento).
    detener();
    gesto.current = {
      puntero: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      xInicial: f.x,
      indiceInicial: f.activa,
      direccion: null,
      historial: [{ x: f.x, t: e.timeStamp }],
    };
    huboArrastre.current = false;
  }

  function alMover(e: EventoPuntero<HTMLDivElement>) {
    const g = gesto.current;
    if (!g || g.puntero !== e.pointerId) return;
    const dx = e.clientX - g.inicioX;
    const dy = e.clientY - g.inicioY;

    if (!g.direccion) {
      if (Math.abs(dx) < UMBRAL_PX && Math.abs(dy) < UMBRAL_PX) return;
      g.direccion = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (g.direccion === 'v') {
        // Era scroll de la página: se suelta y, si venía moviéndose, sigue.
        gesto.current = null;
        irA(fisica.current.activa);
        return;
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // El puntero ya no existe (se soltó justo): se sigue sin captura.
      }
      huboArrastre.current = true;
      setArrastrando(true);
      setTomoElControl(true);
    }

    const f = fisica.current;
    const minimo = -(total - 1) * f.paso;
    let x = g.xInicial + dx;
    if (x > 0) x = elastico(x, f.paso);
    else if (x < minimo) x = minimo - elastico(minimo - x, f.paso);
    f.x = x;
    g.historial.push({ x, t: e.timeStamp });
    // Para la velocidad alcanza con los últimos 100 ms.
    while (g.historial.length > 2 && e.timeStamp - g.historial[0].t > 100) g.historial.shift();
    pintar();
  }

  function alSoltar(e: EventoPuntero<HTMLDivElement>) {
    const g = gesto.current;
    if (!g || g.puntero !== e.pointerId) return;
    gesto.current = null;
    const f = fisica.current;

    if (g.direccion !== 'h') {
      // Un toque sin arrastre: si estaba en movimiento, que termine de llegar.
      irA(f.activa);
      return;
    }
    setArrastrando(false);
    const primero = g.historial[0];
    const ultimo = g.historial[g.historial.length - 1];
    const dt = (ultimo.t - primero.t) / 1000;
    const velocidad = dt > 0 ? (ultimo.x - primero.x) / dt : 0;

    // Hacia dónde iba, no dónde quedó; de a una diapositiva por gesto.
    const proyectada = f.x + proyectar(velocidad);
    let indice = Math.round(-proyectada / f.paso);
    indice = Math.min(Math.max(indice, g.indiceInicial - 1), g.indiceInicial + 1);
    indice = Math.min(Math.max(indice, 0), total - 1);
    irA(indice, {
      velocidad,
      resorte: Math.abs(velocidad) > TIRON_PX_S ? CON_IMPULSO : SIN_REBOTE,
    });
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      elegir(Math.min(activa + 1, total - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      elegir(Math.max(activa - 1, 0));
    }
  }

  return (
    <div
      ref={raizRef}
      className="carrusel"
      role="region"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocus={() => setEnPausa(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEnPausa(false);
      }}
      onKeyDown={alTeclear}
    >
      <div className="carrusel-barra">
        <div className="carrusel-pestanas" role="tablist" aria-label="Secciones del producto">
          <span ref={indicadorRef} className="carrusel-indicador" aria-hidden="true" />
          {diapositivas.map((d, i) => (
            <button
              key={d.id}
              ref={(el) => {
                pestanasRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`pestana-${d.id}`}
              aria-selected={activa === i}
              aria-controls={`diapositiva-${d.id}`}
              tabIndex={activa === i ? 0 : -1}
              className="carrusel-pestana"
              data-cercana={cercana === i}
              onClick={() => elegir(i)}
            >
              {d.etiqueta}
            </button>
          ))}
        </div>

        <div className="carrusel-flechas">
          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco
              y las flechas del teclado dejarían de andar. */}
          <button
            type="button"
            className="carrusel-flecha"
            aria-label="Anterior"
            aria-disabled={activa === 0}
            onClick={() => activa > 0 && elegir(activa - 1)}
          >
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            className="carrusel-flecha"
            aria-label="Siguiente"
            aria-disabled={activa === total - 1}
            onClick={() => activa < total - 1 && elegir(activa + 1)}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={ventanaRef}
        className="carrusel-ventana"
        data-arrastrando={arrastrando}
        onPointerDown={alApoyar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        // Si fue un arrastre, que no cuente como clic en lo que había abajo.
        onClickCapture={(e) => {
          if (huboArrastre.current) {
            e.preventDefault();
            e.stopPropagation();
            huboArrastre.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        <div ref={pistaRef} className="carrusel-pista">
          {diapositivas.map((d, i) => (
            <div
              key={d.id}
              id={`diapositiva-${d.id}`}
              role="tabpanel"
              aria-roledescription="diapositiva"
              aria-labelledby={`pestana-${d.id}`}
              className="carrusel-diapositiva"
              data-activa={activa === i}
              inert={activa !== i}
            >
              {d.contenido}
            </div>
          ))}
        </div>
      </div>

      {/* Cuánto falta para que pase sola; se detiene cuando la persona toma el control. */}
      <div className="carrusel-tiempo" aria-hidden="true">
        {!tomoElControl && !menosMovimiento && (
          <span
            key={activa}
            className="carrusel-tiempo-barra"
            data-en-pausa={!autoavance}
            style={{ animationDuration: `${intervaloMs}ms` }}
            onAnimationEnd={() => irA(activa + 1)}
          />
        )}
      </div>
    </div>
  );
}
