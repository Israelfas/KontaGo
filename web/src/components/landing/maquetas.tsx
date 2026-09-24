import type { CSSProperties, ReactNode } from 'react';
import { CifraAnimada } from '../cifra';
import { ActivityIcon, AlertIcon, CalendarIcon, CameraIcon, LockIcon, StoreIcon } from '../icons';

/*
 * Maquetas de la app hechas con HTML y los mismos colores y letras: se
 * ven nítidas en cualquier pantalla y pesan nada al lado de una captura.
 * Son decorativas (aria-hidden): lo que muestran lo cuenta el texto que
 * las acompaña.
 *
 * Las piezas con "maq-entra" (y las barras) se animan cuando su
 * contenedor está a la vista: el hero al cargar, la diapositiva activa
 * del carrusel, o una sección revelada al scrollear.
 */

/** Orden de aparición escalonada. */
const orden = (i: number) => ({ '--i': i }) as CSSProperties;

export function MarcoNavegador({
  direccion,
  children,
  className = '',
}: {
  direccion: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`maq-navegador ${className}`} aria-hidden="true">
      <div className="maq-navegador-barra">
        <span className="flex gap-1.5">
          <i className="maq-punto" />
          <i className="maq-punto" />
          <i className="maq-punto" />
        </span>
        <span className="maq-direccion">{direccion}</span>
      </div>
      <div className="maq-navegador-cuerpo">{children}</div>
    </div>
  );
}

export function MarcoCelular({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`maq-celular ${className}`} aria-hidden="true">
      <div className="maq-celular-pantalla">
        <span className="maq-celular-isla" />
        {children}
      </div>
    </div>
  );
}

/** La franja oscura con el número, como en la app. */
function Franja({
  eyebrow,
  titulo,
  valor,
  detalle,
  compacta = false,
}: {
  eyebrow: string;
  titulo: string;
  valor: ReactNode;
  detalle?: string;
  compacta?: boolean;
}) {
  return (
    <div className={`maq-franja ${compacta ? 'maq-franja-compacta' : ''}`}>
      <p className="maq-franja-eyebrow maq-entra" style={orden(0)}>
        {eyebrow}
      </p>
      <p className="maq-franja-titulo maq-entra" style={orden(1)}>
        {titulo}
      </p>
      <p className="maq-franja-valor maq-entra" style={orden(2)}>
        {valor}
      </p>
      {detalle && (
        <p className="maq-franja-detalle maq-entra" style={orden(3)}>
          {detalle}
        </p>
      )}
    </div>
  );
}

function MiniMenu({ activa }: { activa: string }) {
  return (
    <div className="maq-menu">
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-ambar text-tinta">
          <StoreIcon className="h-3 w-3" />
        </span>
        <span className="font-display text-[0.7rem] font-bold tracking-[-0.04em] text-tinta">
          Konta<span className="text-ambar">Go</span>
        </span>
      </span>
      <span className="flex gap-1">
        {['Resumen', 'Vender', 'Productos', 'Inventario'].map((s) => (
          <span key={s} className={`maq-menu-item ${s === activa ? 'maq-menu-activo' : ''}`}>
            {s}
          </span>
        ))}
      </span>
    </div>
  );
}

// Ventas por hora de un día normal (8h a 20h), en proporción.
const VENTAS_POR_HORA = [22, 35, 48, 40, 62, 70, 45, 38, 52, 80, 92, 66, 30];

/** El resumen del día en la compu: lo primero que ve el dueño. */
export function MaquetaResumen({ cifra = true }: { cifra?: boolean }) {
  return (
    <>
      <MiniMenu activa="Resumen" />
      <Franja
        eyebrow="Hoy · Minimarket La Esquina"
        titulo="Ganancia"
        valor={cifra ? <CifraAnimada texto="$50,90" /> : '$50,90'}
        detalle="52 ventas · ingreso $242,76"
      />
      <div className="maq-hoja">
        <div className="maq-pieza maq-entra col-span-2" style={orden(3)}>
          <p className="maq-etiqueta">Ventas por hora</p>
          <div className="maq-barras">
            {VENTAS_POR_HORA.map((alto, i) => (
              <span
                key={i}
                className={`maq-barra ${i === 10 ? 'maq-barra-pico' : ''}`}
                style={{ height: `${alto}%`, ...orden(i) }}
              />
            ))}
          </div>
        </div>
        <div className="maq-pieza maq-entra" style={orden(5)}>
          <p className="maq-etiqueta">Más vendido</p>
          <p className="maq-dato">Coca-Cola 500 ml</p>
          <p className="maq-detalle">38 unidades</p>
        </div>
        <div className="maq-pieza maq-entra" style={orden(6)}>
          <p className="maq-etiqueta">Alertas</p>
          <p className="maq-dato text-ambar">4 con stock bajo</p>
          <p className="maq-detalle">5 por vencer</p>
        </div>
      </div>
    </>
  );
}

const CARRITO = [
  { nombre: 'Coca-Cola 500 ml', cantidad: 2, precio: '$1,50' },
  { nombre: 'Pan de molde', cantidad: 1, precio: '$1,65' },
  { nombre: 'Chicle Trident', cantidad: 1, precio: '$0,25' },
];

/** La caja en el celular: se escanea y el carrito se arma solo. */
export function MaquetaVenta() {
  return (
    <div className="flex h-full flex-col">
      <div className="maq-cel-cabecera">
        <p className="maq-franja-eyebrow">Caja abierta</p>
        <p className="font-display text-base font-bold text-papel">Vender</p>
      </div>
      <div className="maq-escaner">
        <CameraIcon className="h-4 w-4 text-papel/70" />
        <span className="maq-codigo" />
        <span className="maq-escaner-linea" />
      </div>
      <ul className="flex-1 space-y-1.5 px-3 pt-3">
        {CARRITO.map((p, i) => (
          <li key={p.nombre} className="maq-item maq-entra" style={orden(i + 2)}>
            <span className="maq-cantidad">{p.cantidad}</span>
            <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
            <span className="font-ticket font-semibold">{p.precio}</span>
          </li>
        ))}
      </ul>
      <div className="maq-cobrar maq-entra" style={orden(6)}>
        <span className="flex items-baseline justify-between">
          <span className="text-[0.7rem] text-tinta-suave">Total con IVA</span>
          <span className="font-display text-lg font-bold text-tinta">$3,40</span>
        </span>
        <span className="maq-boton-cobrar">Cobrar $3,40</span>
      </div>
    </div>
  );
}

/** El cierre de caja: lo contado contra lo que debería haber. */
export function MaquetaCaja() {
  const filas = [
    ['Fondo inicial', '$20,00'],
    ['Ventas en efectivo', '$132,50'],
    ['Compra de fundas', '−$2,50'],
  ];
  return (
    <div className="maq-tarjeta">
      <p className="maq-etiqueta maq-entra" style={orden(0)}>
        Cierre de caja · Carlos
      </p>
      <p className="maq-entra font-display text-lg font-bold text-tinta" style={orden(1)}>
        Resultado del cierre
      </p>
      <div className="mt-3 space-y-1.5">
        {filas.map(([texto, monto], i) => (
          <p key={texto} className="maq-fila maq-entra" style={orden(i + 2)}>
            <span>{texto}</span>
            <span className={`font-ticket ${monto.startsWith('−') ? 'text-rojo-perdida' : ''}`}>
              {monto}
            </span>
          </p>
        ))}
        <p className="maq-fila maq-fila-total maq-entra" style={orden(5)}>
          <span>Debería haber</span>
          <span className="font-ticket">$150,00</span>
        </p>
        <p className="maq-fila maq-entra" style={orden(6)}>
          <span>Contó el cajero</span>
          <span className="font-ticket">$150,00</span>
        </p>
      </div>
      <div className="maq-cuadra maq-entra" style={orden(7)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
          <path d="M7 12.5l3.2 3.2L17 9" className="maq-check" />
        </svg>
        Cuadra: ni sobra ni falta
      </div>
    </div>
  );
}

/** Alertas del inventario y los lotes por vencimiento. */
export function MaquetaInventario() {
  const alertas = [
    { nombre: 'Leche Vita 1 L', detalle: 'Quedan 3', tipo: 'Stock bajo', tono: 'ambar' },
    {
      nombre: 'Yogurt Toni 200 g',
      detalle: 'Lote del 26/09',
      tipo: 'Vence en 2 días',
      tono: 'rojo',
    },
    { nombre: 'Queso fresco', detalle: 'Quedan 4', tipo: 'Stock bajo', tono: 'ambar' },
  ];
  return (
    <div className="maq-tarjeta">
      <p className="maq-etiqueta maq-entra" style={orden(0)}>
        Alertas
      </p>
      <ul className="mt-2 space-y-1.5">
        {alertas.map((a, i) => (
          <li key={a.nombre} className="maq-alerta maq-entra" style={orden(i + 1)}>
            <span className={`maq-alerta-punto maq-${a.tono}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] font-semibold text-tinta">
                {a.nombre}
              </span>
              <span className="block text-[0.7rem] text-tinta-suave">{a.detalle}</span>
            </span>
            <span className={`maq-pastilla maq-pastilla-${a.tono}`}>{a.tipo}</span>
          </li>
        ))}
      </ul>

      <p className="maq-etiqueta maq-entra mt-4" style={orden(4)}>
        Lotes de yogurt · se vende primero el que vence antes
      </p>
      <div className="mt-2 space-y-1.5">
        {[
          { fecha: '26/09', unidades: 6, ancho: '38%', primero: true },
          { fecha: '14/10', unidades: 18, ancho: '100%', primero: false },
        ].map((l, i) => (
          <div key={l.fecha} className="maq-lote maq-entra" style={orden(i + 5)}>
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-tinta-suave" />
            <span className="w-12 font-ticket text-[0.72rem]">{l.fecha}</span>
            <span className="maq-lote-pista">
              <span
                className={`maq-barra-h ${l.primero ? 'bg-rojo-perdida/70' : 'bg-verde-ganancia/60'}`}
                style={{ width: l.ancho, ...orden(i + 5) }}
              />
            </span>
            <span className="w-8 text-right font-ticket text-[0.72rem]">{l.unidades} u</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SEMANA = [
  { dia: 'Jue', alto: 52 },
  { dia: 'Vie', alto: 74 },
  { dia: 'Sáb', alto: 96 },
  { dia: 'Dom', alto: 81 },
  { dia: 'Lun', alto: 44 },
  { dia: 'Mar', alto: 58 },
  { dia: 'Hoy', alto: 63 },
];

/** La ganancia de la semana y lo más vendido. */
export function MaquetaGanancia() {
  return (
    <>
      <Franja
        compacta
        eyebrow="Últimos 7 días"
        titulo="Ganancia"
        valor="$312,45"
        detalle="Ingreso $1.604,20 · perdido $9,80"
      />
      <div className="maq-hoja">
        <div className="maq-pieza col-span-2 maq-entra" style={orden(3)}>
          <div className="maq-barras maq-barras-semana">
            {SEMANA.map((d, i) => (
              <span
                key={d.dia}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span
                  className={`maq-barra w-full ${d.dia === 'Sáb' ? 'maq-barra-pico' : ''}`}
                  style={{ height: `${d.alto * 0.8}%`, ...orden(i) }}
                />
                <span className="font-ticket text-[0.6rem] text-tinta-suave">{d.dia}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="maq-pieza col-span-2 maq-entra" style={orden(5)}>
          <p className="maq-etiqueta">Más vendidos</p>
          {[
            ['Coca-Cola 500 ml', '100%', 212],
            ['Pan de molde', '72%', 153],
            ['Leche Vita 1 L', '55%', 118],
          ].map(([nombre, ancho, unidades], i) => (
            <p key={nombre} className="mt-1.5 flex items-center gap-2 text-[0.72rem]">
              <span className="w-28 truncate text-tinta">{nombre}</span>
              <span className="maq-lote-pista">
                <span
                  className="maq-barra-h bg-tinta/80"
                  style={{ width: ancho as string, ...orden(i + 6) }}
                />
              </span>
              <span className="w-7 text-right font-ticket">{unidades}</span>
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

/** El equipo: roles, último ingreso y una cuenta bloqueada. */
export function MaquetaEquipo() {
  const personas = [
    { nombre: 'Ana Morales', detalle: 'Admin · vos', inicial: 'A', color: 'bg-tinta' },
    {
      nombre: 'Carlos Vera',
      detalle: 'Cajero · entró hace 12 min',
      inicial: 'C',
      color: 'bg-verde-ganancia',
    },
    {
      nombre: 'Rosa Cedeño',
      detalle: 'Cajero · 5 intentos fallidos',
      inicial: 'R',
      color: 'bg-ambar',
      bloqueada: true,
    },
  ];
  return (
    <div className="maq-tarjeta">
      <p className="maq-etiqueta maq-entra" style={orden(0)}>
        Equipo
      </p>
      <ul className="mt-2 space-y-1.5">
        {personas.map((p, i) => (
          <li key={p.nombre} className="maq-alerta maq-entra" style={orden(i + 1)}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-papel ${p.color}`}
            >
              {p.inicial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] font-semibold text-tinta">
                {p.nombre}
              </span>
              <span className="block truncate text-[0.7rem] text-tinta-suave">{p.detalle}</span>
            </span>
            {p.bloqueada && (
              <span className="maq-pastilla maq-pastilla-rojo">
                <LockIcon className="h-3 w-3" />
                Bloqueada
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="maq-actividad maq-entra" style={orden(4)}>
        <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-tinta">
          <ActivityIcon className="h-3.5 w-3.5" />
          Sesiones de Carlos
        </p>
        {[
          ['App en Android', 'usó hace 3 min'],
          ['Chrome en Windows', 'usó ayer 19:40'],
        ].map(([dispositivo, uso]) => (
          <p key={dispositivo} className="mt-1.5 flex justify-between text-[0.7rem]">
            <span className="text-tinta">{dispositivo}</span>
            <span className="text-tinta-suave">{uso}</span>
          </p>
        ))}
        <span className="maq-boton-secundario">Cerrar sesión en todos sus dispositivos</span>
      </div>
    </div>
  );
}

/** El inicio de la app en el celular (sección de descarga). */
export function MaquetaInicioCelular() {
  return (
    <div className="flex h-full flex-col">
      <Franja
        compacta
        eyebrow="Hoy"
        titulo="Ganancia"
        valor={<CifraAnimada texto="$50,90" />}
        detalle="52 ventas"
      />
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        {[
          ['Ingreso', '$242,76', ''],
          ['Anulado', '$6,85', 'text-rojo-perdida'],
          ['Stock bajo', '4', 'text-ambar'],
          ['Por vencer', '5', 'text-ambar'],
        ].map(([etiqueta, valor, color], i) => (
          <div key={etiqueta} className="maq-pieza maq-entra" style={orden(i + 3)}>
            <p className="maq-etiqueta">{etiqueta}</p>
            <p className={`maq-dato ${color}`}>{valor}</p>
          </div>
        ))}
      </div>
      <div className="mx-2.5 maq-alerta maq-entra" style={orden(7)}>
        <AlertIcon className="h-4 w-4 shrink-0 text-ambar" />
        <span className="flex-1 text-[0.72rem] text-tinta">Leche Vita 1 L: quedan 3</span>
      </div>
      <div className="mt-auto flex justify-around border-t border-papel-linea bg-papel/90 px-2 py-2">
        {['Resumen', 'Vender', 'Productos', 'Más'].map((s, i) => (
          <span
            key={s}
            className={`text-[0.6rem] font-semibold ${i === 0 ? 'text-tinta' : 'text-tinta-suave'}`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
