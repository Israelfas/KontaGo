import { BadRequestException } from '@nestjs/common';
import { fechaLocal } from '../../common/formato-fecha';

/** Hasta cuántos días se puede consultar de una vez (ver obtenerResumen). */
export const DIAS_MAXIMOS_RANGO = 92;

export interface RangoFechas {
  /** Primer día incluido, 'AAAA-MM-DD'. */
  desde: string;
  /** Último día incluido, 'AAAA-MM-DD'. */
  hasta: string;
  /** Medianoche (hora local del servidor) del primer día. */
  inicio: Date;
  /** Medianoche del día siguiente al último: el corte es "menor que". */
  finExclusivo: Date;
  dias: number;
}

function medianoche(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia);
  // new Date corre las fechas imposibles (2026-13-01 → enero, 02-30 →
  // marzo) en vez de fallar: si no vuelve a dar lo mismo, no existía.
  return fechaLocal(d) === fecha ? d : new Date(NaN);
}

/**
 * Arma el rango a consultar a partir de dos fechas 'AAAA-MM-DD' (ya
 * validadas en formato por el DTO). Sin fechas, es hoy. Los cortes de día
 * son en la hora local del servidor, igual que el resto del backend.
 */
export function armarRango(desde?: string, hasta?: string): RangoFechas {
  const hoy = fechaLocal(new Date());
  const d = desde ?? hasta ?? hoy;
  const h = hasta ?? desde ?? hoy;

  const inicio = medianoche(d);
  const ultimo = medianoche(h);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(ultimo.getTime())) {
    throw new BadRequestException('Fecha inválida');
  }
  if (inicio > ultimo) {
    throw new BadRequestException('"desde" no puede ser posterior a "hasta"');
  }

  const finExclusivo = new Date(ultimo);
  finExclusivo.setDate(finExclusivo.getDate() + 1);
  // Días de calendario, no milisegundos / 86400000: con cambio de horario
  // un día puede durar 23 o 25 horas.
  let dias = 0;
  for (const c = new Date(inicio); c < finExclusivo; c.setDate(c.getDate() + 1))
    dias++;

  if (dias > DIAS_MAXIMOS_RANGO) {
    throw new BadRequestException(
      `Se pueden consultar hasta ${DIAS_MAXIMOS_RANGO} días de una vez`,
    );
  }
  return { desde: d, hasta: h, inicio, finExclusivo, dias };
}

/** El día de hoy como rango de un solo día. */
export function rangoDeHoy(): RangoFechas {
  return armarRango();
}
