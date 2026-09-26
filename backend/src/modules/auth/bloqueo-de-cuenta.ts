import { EntityManager, IsNull } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { Sesion } from './entities/sesion.entity';
import type { TipoEventoSeguridad } from './entities/evento-seguridad.entity';
import type { ContextoPedido, SeguridadService } from './seguridad.service';

/*
 * Bloqueo de la cuenta y corte de sesiones: lo usan el ingreso
 * (auth.service) y apagar la verificación en dos pasos (dos-pasos.service).
 */

// Tras 5 intentos equivocados seguidos (contraseña o código), la cuenta
// espera 15 minutos. Frena a quien prueba desde muchas IP (el límite por
// IP solo frena a una). Recuperar la contraseña la desbloquea.
const INTENTOS_ANTES_DE_BLOQUEAR = 5;
const MINUTOS_DE_BLOQUEO = 15;

export type MotivoRevocacion =
  | 'cierre'
  | 'reuso'
  | 'usuario_desactivado'
  | 'password_cambiada'
  | 'cerradas_por_el_usuario'
  | 'cerradas_por_admin'
  | 'codigos_equivocados';

export function estaBloqueada(
  usuario: Usuario,
): usuario is Usuario & { bloqueadoHasta: Date } {
  return usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta > new Date();
}

export function mensajeDeBloqueo(hasta: Date): string {
  const minutos = Math.max(
    1,
    Math.ceil((hasta.getTime() - Date.now()) / 60_000),
  );
  return `Por seguridad bloqueamos el ingreso por ${minutos} minuto${
    minutos === 1 ? '' : 's'
  } después de varios intentos fallidos. Prueba de nuevo después o cambia tu contraseña con "¿Olvidaste tu contraseña?".`;
}

/** Suma un intento equivocado; al quinto bloquea. Devuelve si la bloqueó. */
export async function anotarIntentoFallido(
  manager: EntityManager,
  seguridad: SeguridadService,
  usuario: Usuario,
  contexto: ContextoPedido,
  tipo: TipoEventoSeguridad = 'ingreso_fallido',
): Promise<boolean> {
  // Suma en la base (no en memoria): dos intentos simultáneos cuentan dos.
  const [filas] = await manager.query<
    [{ intentos_fallidos: number }[], number]
  >(
    `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1
     WHERE id = $1 RETURNING intentos_fallidos`,
    [usuario.id],
  );
  const intentos = filas[0]?.intentos_fallidos ?? 0;
  await seguridad.registrar(tipo, { usuario, contexto });
  if (intentos < INTENTOS_ANTES_DE_BLOQUEAR) return false;
  await manager.getRepository(Usuario).update(usuario.id, {
    intentosFallidos: 0,
    bloqueadoHasta: new Date(Date.now() + MINUTOS_DE_BLOQUEO * 60_000),
  });
  await seguridad.registrar('cuenta_bloqueada', { usuario, contexto });
  return true;
}

/**
 * Corta todas las sesiones de un usuario (lo desactivaron, le cambiaron
 * la contraseña). Sus tokens dejan de servir en el próximo pedido.
 */
export async function revocarSesiones(
  manager: EntityManager,
  usuarioId: string,
  motivo: MotivoRevocacion,
): Promise<void> {
  // Primero la marca (toma la fila del usuario): un ingreso que ya había
  // verificado la contraseña espera, o encuentra la marca y se rechaza.
  // Después se cortan las sesiones que ya existían.
  const ahora = new Date();
  await manager
    .getRepository(Usuario)
    .update(usuarioId, { sesionesValidasDesde: ahora });
  await manager
    .getRepository(Sesion)
    .update(
      { usuarioId, revocadaEn: IsNull() },
      { revocadaEn: ahora, motivoRevocacion: motivo },
    );
}
