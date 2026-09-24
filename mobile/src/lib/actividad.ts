/**
 * La actividad de seguridad de una cuenta, en palabras. Copia de
 * web/src/lib/actividad.ts.
 */

export type TipoEvento =
  | 'ingreso'
  | 'ingreso_fallido'
  | 'ingreso_bloqueado'
  | 'cuenta_bloqueada'
  | 'ingreso_google'
  | 'cuenta_creada'
  | 'cierre_sesion'
  | 'sesion_revocada_por_reuso'
  | 'recuperacion_pedida'
  | 'password_restablecida'
  | 'password_cambiada_por_admin'
  | 'usuario_desactivado'
  | 'usuario_reactivado'
  | 'sesiones_cerradas'
  | 'cuenta_desbloqueada';

export interface SesionAbierta {
  id: string;
  dispositivo: string;
  ip: string | null;
  abiertaEn: string;
  ultimoUso: string;
  esEsta: boolean;
}

export interface EventoDeCuenta {
  tipo: TipoEvento;
  dispositivo: string | null;
  ip: string | null;
  fecha: string;
}

export interface ActividadDeCuenta {
  sesiones: SesionAbierta[];
  eventos: EventoDeCuenta[];
}

// Rojo: algo que puede ser un intento de entrar a la cuenta.
export const EVENTOS: Record<TipoEvento, { texto: string; alerta?: boolean }> = {
  ingreso: { texto: 'Entró' },
  ingreso_google: { texto: 'Entró con Google' },
  ingreso_fallido: { texto: 'Contraseña equivocada', alerta: true },
  ingreso_bloqueado: { texto: 'Intentó entrar con la cuenta bloqueada', alerta: true },
  cuenta_bloqueada: { texto: 'Cuenta bloqueada por intentos fallidos', alerta: true },
  sesion_revocada_por_reuso: {
    texto: 'Sesión cerrada por seguridad (alguien copió el acceso)',
    alerta: true,
  },
  cuenta_creada: { texto: 'Creó la cuenta' },
  cierre_sesion: { texto: 'Cerró sesión' },
  recuperacion_pedida: { texto: 'Pidió cambiar la contraseña por email' },
  password_restablecida: { texto: 'Cambió la contraseña con el enlace del email' },
  password_cambiada_por_admin: { texto: 'El administrador le cambió la contraseña' },
  usuario_desactivado: { texto: 'Cuenta desactivada' },
  usuario_reactivado: { texto: 'Cuenta reactivada' },
  sesiones_cerradas: { texto: 'Se cerraron todas sus sesiones' },
  cuenta_desbloqueada: { texto: 'Cuenta desbloqueada' },
};

/** "recién", "hace 12 min", "hoy 14:05", "ayer 09:30", "12 sept 18:40". */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso);
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const hora = fecha.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(fecha, ahora)) return `hoy ${hora}`;
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(fecha, ayer)) return `ayer ${hora}`;
  const dia = fecha.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
    ...(fecha.getFullYear() !== ahora.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${dia} ${hora}`;
}
