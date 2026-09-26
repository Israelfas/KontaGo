import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vincular Google sin robo de cuentas:
 * - usuarios.clerk_user_id: la cuenta de Google vinculada (única).
 * - usuarios.email_verificado_en: cuándo se demostró el correo (al crear
 *   la cuenta con Google o al usar un enlace de recuperación).
 *
 * Las cuentas que ya entraron con Google se marcan verificadas (así
 * siguen entrando igual); las demás tendrán que entrar con la contraseña
 * o recuperarla una vez antes de usar Google.
 */
export class VinculoConGoogle1789700000000 implements MigrationInterface {
  name = 'VinculoConGoogle1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "clerk_user_id" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "email_verificado_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_usuarios_clerk_user_id" ON "usuarios" ("clerk_user_id") WHERE "clerk_user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "usuarios" u SET "email_verificado_en" = now()
        WHERE EXISTS (SELECT 1 FROM "eventos_seguridad" e
                       WHERE e.usuario_id = u.id AND e.tipo = 'ingreso_google')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_usuarios_clerk_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "email_verificado_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "clerk_user_id"`,
    );
  }
}
