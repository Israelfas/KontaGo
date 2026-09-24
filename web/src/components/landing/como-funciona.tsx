import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CheckIcon, StoreIcon } from '../icons';
import { Revelar } from './revelar';

/*
 * "Cómo funciona": una franja oscura de borde a borde (como la de las
 * pantallas de la app) con los tres pasos. Al llegar, la línea se dibuja
 * de un número al siguiente y cada número se enciende cuando la línea lo
 * alcanza; cada paso trae una escena chica de lo que se hace en él.
 */

const orden = (i: number) => ({ '--i': i }) as CSSProperties;

/** Paso 1: el nombre de la tienda y listo. */
function EscenaCrear() {
  return (
    <div className="paso-escena-tarjeta">
      <p className="maq-etiqueta">Tu tienda</p>
      <p className="paso-campo">
        <StoreIcon className="h-3.5 w-3.5 shrink-0 text-ambar" />
        Minimarket La Esquina
        <span className="paso-cursor" />
      </p>
      <p className="mt-2 flex items-center justify-between text-[0.68rem] text-tinta-suave">
        <span>o entra con Google</span>
        <span className="paso-boton">Crear</span>
      </p>
    </div>
  );
}

/** Paso 2: un producto escaneado, con precio, costo y stock. */
function EscenaCargar() {
  return (
    <div className="paso-escena-tarjeta">
      <p className="flex items-center gap-2.5">
        <span className="maq-codigo h-7 w-10 flex-none opacity-80 [filter:invert(1)]" />
        <span className="min-w-0">
          <span className="block truncate text-[0.8rem] font-semibold text-tinta">
            Coca-Cola 500 ml
          </span>
          <span className="block font-ticket text-[0.6rem] text-tinta-suave">7861001234567</span>
        </span>
      </p>
      <p className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        {[
          ['Precio', '$0,75'],
          ['Costo', '$0,55'],
          ['Stock', '24'],
        ].map(([etiqueta, valor]) => (
          <span key={etiqueta} className="paso-dato">
            <span className="block text-[0.55rem] uppercase tracking-[0.1em] text-tinta-suave">
              {etiqueta}
            </span>
            <span className="block font-display text-[0.8rem] font-bold text-tinta">{valor}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** Paso 3: al cerrar el día, lo que quedó. */
function EscenaVender() {
  return (
    <div className="paso-escena-tarjeta">
      <p className="maq-etiqueta">Hoy</p>
      <p className="font-display text-2xl font-bold tracking-[-0.05em] text-tinta">$50,90</p>
      <p className="text-[0.68rem] text-tinta-suave">de ganancia en 52 ventas</p>
      <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] font-semibold text-verde-ganancia">
        <CheckIcon className="h-3.5 w-3.5" />
        La caja cuadra
      </p>
    </div>
  );
}

const PASOS: { titulo: string; texto: string; cuando: string; escena: ReactNode }[] = [
  {
    titulo: 'Crea tu tienda',
    texto: 'Con tu email o tu cuenta de Google. Le pones el nombre y ya puedes vender.',
    cuando: 'En un minuto',
    escena: <EscenaCrear />,
  },
  {
    titulo: 'Carga tus productos',
    texto: 'Escaneas el código con la cámara, pones precio y costo, y registras lo que tienes.',
    cuando: 'Con la cámara',
    escena: <EscenaCargar />,
  },
  {
    titulo: 'Vende y mira tu ganancia',
    texto: 'Desde la caja o el celular. Al cerrar el día sabes cuánto vendiste y cuánto te quedó.',
    cuando: 'Todos los días',
    escena: <EscenaVender />,
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="pasos-banda">
      <div className="pasos-brillo pasos-brillo-ambar" aria-hidden="true" />
      <div className="pasos-brillo pasos-brillo-verde" aria-hidden="true" />

      <div className="app-container relative">
        <Revelar className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="font-ticket text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ambar">
              Cómo funciona
            </p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.6vw,3.3rem)] font-bold leading-none tracking-[-0.052em] text-papel">
              Empieza hoy, en tres pasos.
            </h2>
            <p className="mt-4 text-[1.05rem] leading-7 text-papel/70">
              Sin instalar nada raro ni comprar equipos: de crear tu cuenta a tu primera venta, en
              minutos.
            </p>
          </div>
          <Link href="/registro" className="button pasos-cta shrink-0 self-start lg:self-auto">
            Crear mi tienda gratis
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Revelar>

        <Revelar className="mt-12 lg:mt-16">
          <ol className="pasos">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="paso" style={orden(i)}>
                <div className="flex items-center gap-3">
                  <span className="paso-numero">{i + 1}</span>
                  <span className="paso-cuando">{paso.cuando}</span>
                </div>
                <div className="paso-tarjeta">
                  <div className="paso-escena" aria-hidden="true">
                    {paso.escena}
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-[-0.035em] text-papel">
                    {paso.titulo}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-7 text-papel/65">{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </Revelar>
      </div>
    </section>
  );
}
