import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Desde ahora el backend guarda y busca los emails en minúsculas (ver
 * NormalizarEmail). Los usuarios ya existentes con mayúsculas no podrían
 * loguearse si no se normalizan también. Si dos cuentas quedaran con el
 * mismo email al normalizar ("Juan@x.com" y "juan@x.com"), la migración
 * falla a propósito: hay que decidir a mano cuál de las dos se queda.
 */
export class EmailMinusculas1788000000000 implements MigrationInterface {
  name = 'EmailMinusculas1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const colisiones = (await queryRunner.query(`
      SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS cantidad
      FROM usuarios
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    `)) as { email: string }[];

    if (colisiones.length > 0) {
      throw new Error(
        `No se pueden normalizar los emails: ${colisiones.length} email(s) ` +
          `quedarían repetidos (${colisiones.map((c) => c.email).join(', ')}). ` +
          `Hay que resolverlos a mano antes de reintentar esta migración.`,
      );
    }

    await queryRunner.query(
      `UPDATE usuarios SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))`,
    );
  }

  public async down(): Promise<void> {
    // No hay vuelta atrás: las mayúsculas originales no se guardaron, y
    // tampoco hace falta restaurarlas para que nada funcione.
  }
}
