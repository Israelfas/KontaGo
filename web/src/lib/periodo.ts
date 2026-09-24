/**
 * Períodos del historial (Resumen y Ventas). Las fechas son de calendario,
 * 'AAAA-MM-DD', en la hora local del dispositivo: el mismo día que ve la
 * persona en su reloj. El backend corta los días en la hora de Ecuador.
 */

export type ClavePeriodo = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mes-pasado' | 'elegido';

export interface Periodo {
  clave: ClavePeriodo;
  desde: string;
  hasta: string;
}

/** El mismo tope que el backend. */
export const DIAS_MAXIMOS_PERIODO = 92;

export const OPCIONES_PERIODO: { clave: Exclude<ClavePeriodo, 'elegido'>; texto: string }[] = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'ayer', texto: 'Ayer' },
  { clave: 'semana', texto: '7 días' },
  { clave: 'mes', texto: 'Este mes' },
  { clave: 'mes-pasado', texto: 'Mes pasado' },
];

const dos = (n: number) => String(n).padStart(2, '0');

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** 'AAAA-MM-DD' → Date a la medianoche local (no UTC: en Ecuador sería el día anterior). */
export function aFecha(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export function hoyISO(): string {
  return fechaISO(new Date());
}

export function periodoPredefinido(clave: Exclude<ClavePeriodo, 'elegido'>): Periodo {
  const hoy = new Date();
  switch (clave) {
    case 'hoy':
      return { clave, desde: fechaISO(hoy), hasta: fechaISO(hoy) };
    case 'ayer': {
      const ayer = fechaISO(sumarDias(hoy, -1));
      return { clave, desde: ayer, hasta: ayer };
    }
    case 'semana':
      return { clave, desde: fechaISO(sumarDias(hoy, -6)), hasta: fechaISO(hoy) };
    case 'mes':
      return {
        clave,
        desde: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        hasta: fechaISO(hoy),
      };
    case 'mes-pasado':
      return {
        clave,
        desde: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        // El día 0 de este mes es el último del anterior.
        hasta: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      };
  }
}

export function periodoDeHoy(): Periodo {
  return periodoPredefinido('hoy');
}

/** Días de calendario entre las dos fechas, ambas incluidas. */
export function diasDelPeriodo(desde: string, hasta: string): number {
  let dias = 0;
  for (let d = aFecha(desde); d <= aFecha(hasta); d = sumarDias(d, 1)) dias++;
  return dias;
}

/** Por qué un rango elegido a mano no sirve, o null si está bien. */
export function problemaDelRango(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return 'Elige las dos fechas.';
  if (desde > hasta) return 'La fecha de inicio tiene que ser anterior a la de fin.';
  if (hasta > hoyISO()) return 'Todavía no hay ventas de días que no llegaron.';
  if (diasDelPeriodo(desde, hasta) > DIAS_MAXIMOS_PERIODO)
    return `Se pueden ver hasta ${DIAS_MAXIMOS_PERIODO} días de una vez.`;
  return null;
}

/** Un rango elegido a mano; si coincide con uno de los botones, toma su clave. */
export function periodoElegido(desde: string, hasta: string): Periodo {
  for (const { clave } of OPCIONES_PERIODO) {
    const p = periodoPredefinido(clave);
    if (p.desde === desde && p.hasta === hasta) return p;
  }
  return { clave: 'elegido', desde, hasta };
}

/** Lee ?desde&hasta de la URL. Sin fechas o con fechas inválidas, es hoy. */
export function periodoDeLaURL(busqueda: string): Periodo {
  const q = new URLSearchParams(busqueda);
  const desde = q.get('desde');
  const hasta = q.get('hasta') ?? desde;
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!desde || !hasta || !formato.test(desde) || !formato.test(hasta)) return periodoDeHoy();
  if (fechaISO(aFecha(desde)) !== desde || fechaISO(aFecha(hasta)) !== hasta) return periodoDeHoy();
  if (problemaDelRango(desde, hasta)) return periodoDeHoy();
  return periodoElegido(desde, hasta);
}

/** '?desde=…&hasta=…', o '' para hoy (la URL limpia es la de siempre). */
export function busquedaDelPeriodo(p: Periodo): string {
  if (p.clave === 'hoy') return '';
  return `?${new URLSearchParams({ desde: p.desde, hasta: p.hasta })}`;
}

export function esHoy(p: Periodo): boolean {
  return p.desde === p.hasta && p.desde === hoyISO();
}

export function incluyeHoy(p: Periodo): boolean {
  const hoy = hoyISO();
  return p.desde <= hoy && hoy <= p.hasta;
}

/** El período de igual largo inmediatamente anterior (para comparar). */
export function periodoAnterior(p: Periodo): Periodo {
  const dias = diasDelPeriodo(p.desde, p.hasta);
  const hasta = sumarDias(aFecha(p.desde), -1);
  return {
    clave: 'elegido',
    desde: fechaISO(sumarDias(hasta, -(dias - 1))),
    hasta: fechaISO(hasta),
  };
}

const LOCALE = 'es-EC';

/** "martes 22 de septiembre" (con el año si no es este). */
export function fechaLarga(fecha: string): string {
  const d = aFecha(fecha);
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** "22 sept" (con el año si no es este). */
function fechaCorta(fecha: string, conAnio: boolean): string {
  return aFecha(fecha).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(conAnio ? { year: 'numeric' } : {}),
  });
}

/** "16 – 22 sept", "28 ago – 3 sept", "hoy", "martes 22 de septiembre". */
export function rangoLegible(p: Periodo): string {
  if (p.desde === p.hasta) return esHoy(p) ? 'hoy' : fechaLarga(p.desde);
  const d = aFecha(p.desde);
  const h = aFecha(p.hasta);
  const esteAnio = new Date().getFullYear();
  const conAnio = d.getFullYear() !== esteAnio || h.getFullYear() !== esteAnio;
  if (d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth()) {
    return `${d.getDate()} – ${fechaCorta(p.hasta, conAnio)}`;
  }
  return `${fechaCorta(p.desde, conAnio)} – ${fechaCorta(p.hasta, conAnio)}`;
}

/** Nombre corto para títulos: "Hoy", "Ayer", "Últimos 7 días", "Septiembre"… */
export function nombreDelPeriodo(p: Periodo): string {
  switch (p.clave) {
    case 'hoy':
      return 'Hoy';
    case 'ayer':
      return 'Ayer';
    case 'semana':
      return 'Últimos 7 días';
    case 'mes':
    case 'mes-pasado': {
      const mes = aFecha(p.desde).toLocaleDateString(LOCALE, { month: 'long' });
      return mes[0].toUpperCase() + mes.slice(1);
    }
    case 'elegido': {
      const texto = rangoLegible(p);
      return texto[0].toUpperCase() + texto.slice(1);
    }
  }
}
