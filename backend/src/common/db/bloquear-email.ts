import { EntityManager } from 'typeorm';

/**
 * Lock de Postgres por email, liberado al terminar la transacción.
 * El índice único de Usuario es (tenantId, email), así que la base no
 * frena por sí sola dos altas con el mismo email en tenants distintos —
 * pero el login busca solo por email, así que tiene que ser único en
 * toda la plataforma. Todo alta de usuario (registro, Clerk, alta de
 * cajeros) toma este lock y recién ahí verifica que el email esté libre.
 */
export async function bloquearEmail(
  manager: EntityManager,
  email: string,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
}
