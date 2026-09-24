import type { CSSProperties, ReactNode } from 'react';
import { AlertIcon, CheckIcon, LockIcon } from '../icons';
import { Revelar } from './revelar';

/*
 * "Los detalles": cuatro tarjetas en mosaico, cada una con una escena que
 * muestra lo que cuenta (no un ícono suelto). El mosaico cierra en todos
 * los anchos:
 *
 *   pc (3 col)             tablet (2 col)       celular
 *   [ escáner   ][avisos]  [ escáner     ]      [escáner]
 *   [ticket][clave][avisos][ avisos      ]      [avisos ]
 *                          [ticket][clave]      [ticket ] ...
 */

const orden = (i: number) => ({ '--i': i }) as CSSProperties;

function Tarjeta({
  titulo,
  texto,
  escena,
  className = '',
  retraso,
}: {
  titulo: string;
  texto: string;
  escena: ReactNode;
  className?: string;
  retraso: number;
}) {
  return (
    <Revelar retraso={retraso} className={className}>
      <article className="detalle">
        <div className="detalle-escena" aria-hidden="true">
          {escena}
        </div>
        <h3 className="mt-5 font-display text-lg font-bold tracking-[-0.03em] text-tinta">
          {titulo}
        </h3>
        <p className="mt-1.5 text-[0.95rem] leading-7 text-tinta-suave">{texto}</p>
      </article>
    </Revelar>
  );
}

/** La cámara encuadra el código, lo lee y el producto entra al carrito. */
function EscenaEscaner() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-5 px-4">
      <div className="visor">
        <span className="visor-esquinas" />
        <span className="maq-codigo visor-codigo" />
        <span className="visor-linea" />
      </div>
      <div className="hidden w-48 space-y-2 sm:block">
        <p className="maq-item maq-entra" style={orden(1)}>
          <span className="maq-cantidad">1</span>
          <span className="flex-1 truncate">Coca-Cola 500 ml</span>
          <span className="font-ticket font-semibold">$0,75</span>
        </p>
        <p className="maq-item maq-entra" style={orden(2)}>
          <span className="maq-cantidad">1</span>
          <span className="flex-1 truncate">Pan de molde</span>
          <span className="font-ticket font-semibold">$1,65</span>
        </p>
        <p
          className="maq-entra flex items-center gap-1.5 pl-1 text-[0.7rem] font-semibold text-verde-ganancia"
          style={orden(3)}
        >
          <CheckIcon className="h-3.5 w-3.5" />
          Leído al instante
        </p>
      </div>
    </div>
  );
}

const AVISOS = [
  { nombre: 'Leche Vita 1 L', detalle: 'Quedan 3', tono: 'ambar' },
  { nombre: 'Yogurt Toni 200 g', detalle: 'Vence en 2 días', tono: 'rojo' },
  { nombre: 'Pan de molde', detalle: 'Quedan 2', tono: 'ambar' },
  { nombre: 'Queso fresco', detalle: 'Vence mañana', tono: 'rojo' },
];

/** Los avisos van llegando, uno debajo del otro. */
function EscenaAvisos() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 px-4 py-5">
      <p className="maq-entra mb-1 flex items-center justify-between px-1" style={orden(0)}>
        <span className="flex items-center gap-2 text-[0.75rem] font-semibold text-tinta">
          <span className="punto-vivo" />
          Alertas de hoy
        </span>
        <span className="font-ticket text-[0.65rem] text-tinta-suave">4 nuevas</span>
      </p>
      {AVISOS.map((a, i) => (
        <div key={a.nombre} className="aviso-detalle maq-entra" style={orden(i + 1)}>
          <span className={`aviso-flotante-icono aviso-${a.tono}`}>
            <AlertIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.8rem] font-semibold text-tinta">
              {a.nombre}
            </span>
            <span className="block text-[0.72rem] text-tinta-suave">{a.detalle}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** El ticket sale de la impresora con los datos de la tienda. */
function EscenaTicket() {
  return (
    <div className="flex h-full w-full items-end justify-center overflow-hidden">
      <div className="ticket-mini">
        <p className="text-center font-display text-[0.8rem] font-bold text-tinta">
          Minimarket La Esquina
        </p>
        <p className="text-center text-[0.6rem] text-tinta-suave">RUC 1790012345001</p>
        <p className="mt-2 flex justify-between border-t border-dashed border-papel-linea pt-1.5">
          <span>2 × Coca-Cola 500 ml</span>
          <span>$1,50</span>
        </p>
        <p className="flex justify-between">
          <span>1 × Pan de molde</span>
          <span>$1,65</span>
        </p>
        <p className="mt-1 flex justify-between font-semibold text-tinta">
          <span>Ticket #129</span>
          <span>$3,15</span>
        </p>
      </div>
    </div>
  );
}

/** La contraseña con su medidor, y el bloqueo por intentos. */
function EscenaClave() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2.5 px-5">
      <div className="clave-campo maq-entra" style={orden(1)}>
        <LockIcon className="h-4 w-4 shrink-0 text-tinta-suave" />
        <span className="flex-1 font-ticket tracking-[0.3em] text-tinta">••••••••••</span>
      </div>
      <div className="flex gap-1 maq-entra" style={orden(2)}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="clave-barra" style={orden(i + 3)} />
        ))}
      </div>
      <p
        className="maq-entra flex items-center justify-between text-[0.7rem] font-semibold"
        style={orden(3)}
      >
        <span className="text-verde-ganancia">Contraseña fuerte</span>
        <span className="maq-pastilla maq-pastilla-rojo">
          <LockIcon className="h-3 w-3" />5 intentos y se bloquea
        </span>
      </p>
    </div>
  );
}

export function Detalles() {
  return (
    <div className="detalles">
      <Tarjeta
        className="detalles-escaner"
        retraso={0}
        titulo="El celular es el escáner"
        texto="Sin lector ni equipos caros: la cámara lee el código de barras y el producto entra al carrito con su precio."
        escena={<EscenaEscaner />}
      />
      <Tarjeta
        className="detalles-avisos"
        retraso={90}
        titulo="Avisos a tiempo"
        texto="Stock bajo y productos por vencer, antes de que sean un problema."
        escena={<EscenaAvisos />}
      />
      <Tarjeta
        retraso={180}
        titulo="Ticket con tus datos"
        texto="Numerado, con el RUC, la razón social y la dirección de tu tienda."
        escena={<EscenaTicket />}
      />
      <Tarjeta
        retraso={270}
        titulo="Cuentas protegidas"
        texto="Contraseñas seguras, bloqueo tras intentos fallidos y recuperación por email."
        escena={<EscenaClave />}
      />
    </div>
  );
}
