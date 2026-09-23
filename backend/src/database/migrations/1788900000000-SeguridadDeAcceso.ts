import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seguridad de acceso (ISO/IEC 27002:2022, controles 5.17, 8.5 y 8.15):
 * - bloqueo temporal de la cuenta tras varios intentos fallidos;
 * - recuperación de contraseña por email (se guarda solo el hash del
 *   enlace);
 * - registro de eventos de seguridad. Sin claves foráneas a propósito:
 *   el registro se conserva aunque se borre la cuenta o la tienda;
 * - fecha en que se aceptaron los términos (LOPDP).
 */
export class SeguridadDeAcceso1788900000000 implements MigrationInterface {
  name = 'SeguridadDeAcceso1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "intentos_fallidos" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "bloqueado_hasta" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "terminos_aceptados_en" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(`
      CREATE TABLE "recuperaciones_password" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuario_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usada_en" TIMESTAMP WITH TIME ZONE,
        "ip" character varying(64),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recuperaciones_password" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recuperaciones_usuario" FOREIGN KEY ("usuario_id")
          REFERENCES "usuarios"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_recuperaciones_token" ON "recuperaciones_password" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recuperaciones_usuario" ON "recuperaciones_password" ("usuario_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "eventos_seguridad" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "usuario_id" uuid,
        "email" character varying(150),
        "tipo" character varying(40) NOT NULL,
        "ip" character varying(64),
        "user_agent" character varying(200),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_eventos_seguridad" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_eventos_seguridad_tenant" ON "eventos_seguridad" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eventos_seguridad_usuario" ON "eventos_seguridad" ("usuario_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "eventos_seguridad"`);
    await queryRunner.query(`DROP TABLE "recuperaciones_password"`);
    for (const columna of [
      'terminos_aceptados_en',
      'bloqueado_hasta',
      'intentos_fallidos',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "usuarios" DROP COLUMN "${columna}"`,
      );
    }
  }
}
