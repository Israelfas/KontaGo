import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sesiones guardadas (ver auth/entities/sesion.entity.ts): permiten
 * cerrar sesión de verdad, cortar el acceso de un usuario desactivado al
 * instante y detectar un refreshToken robado.
 *
 * Los tokens emitidos antes de esta migración no traen sesión: quien
 * tenga la app abierta va a tener que iniciar sesión una vez más.
 */
export class Sesiones1788500000000 implements MigrationInterface {
  name = 'Sesiones1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sesiones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "jti_actual" uuid NOT NULL, "jti_anterior" uuid, "rotada_en" TIMESTAMP WITH TIME ZONE, "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL, "revocada_en" TIMESTAMP WITH TIME ZONE, "motivo_revocacion" character varying(40), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_sesiones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sesiones_usuario" ON "sesiones" ("usuario_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD CONSTRAINT "FK_sesiones_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sesiones"`);
  }
}
