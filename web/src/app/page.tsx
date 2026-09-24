import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppLogo } from '@/components/ui';
import { ArrowRightIcon, CheckIcon, SparklesIcon } from '@/components/icons';
import { CORREO_SOPORTE } from '@/components/documento-legal';
import { Encabezado } from '@/components/landing/encabezado';
import { Revelar } from '@/components/landing/revelar';
import { AvisosEnVivo } from '@/components/landing/avisos-en-vivo';
import { Carrusel, type Diapositiva } from '@/components/landing/carrusel';
import { ComoFunciona } from '@/components/landing/como-funciona';
import { Descarga } from '@/components/landing/descarga';
import { Detalles } from '@/components/landing/detalles';
import {
  MarcoCelular,
  MarcoNavegador,
  MaquetaCaja,
  MaquetaEquipo,
  MaquetaGanancia,
  MaquetaInicioCelular,
  MaquetaInventario,
  MaquetaResumen,
  MaquetaVenta,
} from '@/components/landing/maquetas';
import './landing.css';

export const metadata: Metadata = {
  title: 'KontaGo · La caja de tu tienda, en el celular',
  description:
    'Vendé escaneando con el celular, cerrá la caja sin diferencias y sabé cuánto ganás de verdad. Para tiendas y minimarkets de Ecuador.',
  openGraph: {
    title: 'KontaGo · La caja de tu tienda, en el celular',
    description:
      'Ventas, caja, inventario con vencimientos y tu ganancia real, desde el celular o la compu.',
    type: 'website',
    locale: 'es_EC',
  },
};

// --- Carrusel del producto ---

function TextoDiapositiva({
  etiqueta,
  titulo,
  texto,
  puntos,
}: {
  etiqueta: string;
  titulo: string;
  texto: string;
  puntos: string[];
}) {
  return (
    <div className="flex flex-col justify-center">
      <p className="eyebrow">{etiqueta}</p>
      <h3 className="font-display text-2xl font-bold leading-[1.05] tracking-[-0.045em] text-tinta sm:text-3xl">
        {titulo}
      </h3>
      <p className="mt-3 max-w-md text-[0.95rem] leading-7 text-tinta-suave">{texto}</p>
      <ul className="mt-5 space-y-2.5">
        {puntos.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-tinta">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verde-ganancia/12 text-verde-ganancia">
              <CheckIcon className="h-3 w-3" />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tarjeta({ texto, maqueta }: { texto: ReactNode; maqueta: ReactNode }) {
  return (
    <div className="diapositiva-tarjeta">
      {texto}
      <div className="diapositiva-escena">{maqueta}</div>
    </div>
  );
}

const DIAPOSITIVAS: Diapositiva[] = [
  {
    id: 'vender',
    etiqueta: 'Vender',
    contenido: (
      <Tarjeta
        texto={
          <TextoDiapositiva
            etiqueta="Vender"
            titulo="Cobrá en segundos."
            texto="Escaneá con la cámara del celular o con el lector de la caja: el carrito suma solo, con el IVA incluido, y cada venta queda con su ticket numerado."
            puntos={[
              'Escáner con la cámara del celular',
              'Efectivo o transferencia',
              'Ticket listo para imprimir',
            ]}
          />
        }
        maqueta={
          <MarcoCelular className="maq-celular-escena">
            <MaquetaVenta />
          </MarcoCelular>
        }
      />
    ),
  },
  {
    id: 'caja',
    etiqueta: 'Caja',
    contenido: (
      <Tarjeta
        texto={
          <TextoDiapositiva
            etiqueta="Caja"
            titulo="La caja cuadra, o sabés por qué no."
            texto="Cada uno abre su caja con un fondo y anota lo que saca o pone. Al cerrar, el cajero cuenta el efectivo sin ver cuánto debería haber, y KontaGo te dice si cuadra, sobra o falta."
            puntos={[
              'Conteo a ciegas para el cajero',
              'Retiros y depósitos con motivo',
              'Historial de cierres del equipo',
            ]}
          />
        }
        maqueta={<MaquetaCaja />}
      />
    ),
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    contenido: (
      <Tarjeta
        texto={
          <TextoDiapositiva
            etiqueta="Inventario"
            titulo="Stock y vencimientos, sin sorpresas."
            texto="Cargás lo que compraste con su costo y fecha de vencimiento. KontaGo descuenta primero lo que vence antes y te avisa cuando algo se acaba o está por vencer."
            puntos={[
              'Lotes por fecha de vencimiento',
              'Alertas de stock bajo',
              'Mermas registradas con su motivo',
            ]}
          />
        }
        maqueta={<MaquetaInventario />}
      />
    ),
  },
  {
    id: 'resumen',
    etiqueta: 'Resumen',
    contenido: (
      <Tarjeta
        texto={
          <TextoDiapositiva
            etiqueta="Resumen"
            titulo="Tu ganancia real, no solo lo vendido."
            texto="Ves lo que te quedó después del costo de cada producto, por día, semana o el período que elijas, con lo más vendido y lo que se perdió."
            puntos={[
              'Ganancia por día, semana o mes',
              'Los productos que más salen',
              'Pérdidas por mermas y anulaciones',
            ]}
          />
        }
        maqueta={
          <MarcoNavegador direccion="Resumen · 7 días" className="maq-navegador-escena">
            <MaquetaGanancia />
          </MarcoNavegador>
        }
      />
    ),
  },
  {
    id: 'equipo',
    etiqueta: 'Equipo',
    contenido: (
      <Tarjeta
        texto={
          <TextoDiapositiva
            etiqueta="Equipo"
            titulo="Tu equipo, con los permisos justos."
            texto="Los cajeros venden y consultan productos, pero no ven ganancias ni inventario. Vos ves desde dónde entra cada uno y podés cerrar sus sesiones al instante."
            puntos={[
              'Roles de administrador y cajero',
              'Bloqueo tras intentos fallidos',
              'Actividad y sesiones de cada cuenta',
            ]}
          />
        }
        maqueta={<MaquetaEquipo />}
      />
    ),
  },
];

// --- Preguntas ---

const PREGUNTAS = [
  {
    p: '¿Cuánto cuesta?',
    r: 'Podés crear tu cuenta y empezar a usarla gratis, sin tarjeta.',
  },
  {
    p: '¿Necesito comprar un lector de códigos o una computadora?',
    r: 'No. Con el celular alcanza: la cámara escanea los códigos. Si ya tenés un lector o una compu en la caja, también funcionan.',
  },
  {
    p: '¿Emite facturas electrónicas del SRI?',
    r: 'Todavía no. Cada venta tiene su ticket numerado con los datos de tu tienda, pero ese ticket no reemplaza a la factura. La facturación electrónica está en camino.',
  },
  {
    p: '¿Funciona sin internet?',
    r: 'Por ahora necesita conexión, aunque sea la del celular. Vender sin internet es una de las próximas mejoras.',
  },
  {
    p: '¿Puedo tener cajeros?',
    r: 'Sí. Creás una cuenta para cada persona. Los cajeros venden y consultan productos; las ganancias, el inventario y el equipo solo los ve el administrador.',
  },
  {
    p: '¿Mis datos están seguros?',
    r: 'Las contraseñas se guardan cifradas, las cuentas se bloquean tras varios intentos fallidos y cada tienda ve solo sus datos. Además, podés ver desde dónde entró cada persona y cerrar sus sesiones.',
  },
];

const escalon = (i: number) => ({ '--i': i }) as CSSProperties;

export default function Landing() {
  return (
    <div className="landing">
      <Encabezado />

      <main>
        {/* Hero */}
        <section className="landing-hero">
          <div className="app-container grid items-center gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-10">
            <div className="relative z-10">
              <p className="hero-entra hero-pastilla" style={escalon(0)}>
                <SparklesIcon className="h-3.5 w-3.5 text-ambar" />
                Para tiendas y minimarkets de Ecuador
              </p>
              <h1 className="hero-entra hero-titulo" style={escalon(1)}>
                La caja de tu tienda, <span className="hero-subrayado">en el celular.</span>
              </h1>
              <p className="hero-entra hero-bajada" style={escalon(2)}>
                Vendé escaneando con la cámara, cerrá la caja sin diferencias y sabé cuánto ganás de
                verdad, cada día.
              </p>
              <div className="hero-entra mt-8 flex flex-wrap items-center gap-3" style={escalon(3)}>
                <Link href="/registro" className="button button-primary hero-boton">
                  Crear mi tienda gratis
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a href="#descargar" className="button button-secondary hero-boton">
                  Descargar la app
                </a>
              </div>
              <p
                className="hero-entra mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-tinta-suave"
                style={escalon(4)}
              >
                {['Gratis para empezar', 'Sin tarjeta', 'En la compu y el celular'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5 text-verde-ganancia" />
                    {t}
                  </span>
                ))}
              </p>
            </div>

            <div className="hero-escena">
              <div className="hero-resplandor" aria-hidden="true" />
              <MarcoNavegador direccion="kontago · Resumen" className="hero-navegador">
                <MaquetaResumen />
              </MarcoNavegador>
              <MarcoCelular className="hero-celular">
                <MaquetaVenta />
              </MarcoCelular>
              <AvisosEnVivo />
            </div>
          </div>
        </section>

        {/* Producto */}
        <section id="producto" className="landing-seccion">
          <div className="app-container">
            <Revelar className="landing-cabecera">
              <p className="eyebrow">El producto</p>
              <h2 className="landing-titulo">Todo lo de tu tienda, en un solo lugar.</h2>
              <p className="landing-bajada">
                De la venta al cierre de caja, del stock a tu ganancia. Arrastrá para recorrerlo.
              </p>
            </Revelar>
            <Revelar retraso={120}>
              <Carrusel diapositivas={DIAPOSITIVAS} etiqueta="Recorrido por KontaGo" />
            </Revelar>
          </div>
        </section>

        <ComoFunciona />

        {/* Detalles */}
        <section className="landing-seccion">
          <div className="app-container">
            <Revelar className="landing-cabecera">
              <p className="eyebrow">Los detalles</p>
              <h2 className="landing-titulo">Pensado para el mostrador.</h2>
              <p className="landing-bajada">
                Lo que hace que la caja ande rápido y sin errores, todos los días.
              </p>
            </Revelar>
            <Detalles />
          </div>
        </section>

        {/* Descargar */}
        <section id="descargar" className="landing-seccion">
          <div className="app-container">
            <Revelar className="descarga">
              <div className="descarga-brillo descarga-brillo-ambar" aria-hidden="true" />
              <div className="descarga-brillo descarga-brillo-verde" aria-hidden="true" />
              <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <p className="font-ticket text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ambar">
                    La app
                  </p>
                  <h2 className="mt-3 font-display text-4xl font-bold leading-[0.98] tracking-[-0.055em] text-papel sm:text-5xl">
                    Tu tienda, en el bolsillo.
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-7 text-papel/70">
                    Vendé desde el mostrador, mirá la ganancia del día desde tu casa y recibí los
                    avisos de stock donde estés. La misma cuenta en la compu y en el celular.
                  </p>
                  <div className="mt-8">
                    <Descarga />
                  </div>
                </div>
                <div className="relative hidden justify-center sm:flex">
                  <MarcoCelular className="descarga-celular">
                    <MaquetaInicioCelular />
                  </MarcoCelular>
                </div>
              </div>
            </Revelar>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="landing-seccion">
          <div className="app-container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <Revelar>
              <p className="eyebrow">Preguntas</p>
              <h2 className="landing-titulo">Lo que todos preguntan.</h2>
              {CORREO_SOPORTE && (
                <p className="landing-bajada">
                  ¿Otra duda? Escribinos a{' '}
                  <a
                    href={`mailto:${CORREO_SOPORTE}`}
                    className="font-semibold text-tinta underline decoration-ambar decoration-2 underline-offset-4"
                  >
                    {CORREO_SOPORTE}
                  </a>
                  .
                </p>
              )}
            </Revelar>
            <div className="preguntas">
              {PREGUNTAS.map((q, i) => (
                <Revelar key={q.p} retraso={i * 50}>
                  <details className="pregunta">
                    <summary>
                      {q.p}
                      <span className="pregunta-signo" aria-hidden="true" />
                    </summary>
                    <p>{q.r}</p>
                  </details>
                </Revelar>
              ))}
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="landing-seccion pt-4">
          <div className="app-container">
            <Revelar className="cierre">
              <h2 className="font-display text-3xl font-bold leading-[1.02] tracking-[-0.05em] text-tinta sm:text-5xl">
                Abrí tu caja hoy.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-tinta-suave">
                Creá tu tienda gratis y hacé tu primera venta en minutos.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/registro" className="button button-primary hero-boton">
                  Crear mi tienda gratis
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href="/login" className="button button-secondary hero-boton">
                  Ya tengo cuenta
                </Link>
              </div>
            </Revelar>
          </div>
        </section>
      </main>

      <footer className="landing-pie">
        <div className="app-container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <AppLogo />
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/terminos" className="landing-enlace-pie">
              Términos
            </Link>
            <Link href="/privacidad" className="landing-enlace-pie">
              Privacidad
            </Link>
            {CORREO_SOPORTE && (
              <a href={`mailto:${CORREO_SOPORTE}`} className="landing-enlace-pie">
                Soporte
              </a>
            )}
          </nav>
          <p className="text-xs text-tinta-suave">Hecho en Ecuador · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
