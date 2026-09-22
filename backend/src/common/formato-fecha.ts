// Fechas de calendario ('AAAA-MM-DD'), como fechaVencimiento. Se manejan
// como texto para no arrastrar horas ni zonas horarias.
export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** 'AAAA-MM-DD' del día de `fecha` según la zona horaria del servidor (TZ). */
export function fechaLocal(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** '2026-09-30' → '30 de septiembre de 2026', sin pasar por medianoche UTC. */
export function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
