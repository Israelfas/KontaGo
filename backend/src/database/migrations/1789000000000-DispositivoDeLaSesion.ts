import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Desde qué dispositivo e IP se abrió cada sesión, para la pantalla de
 * actividad (ISO/IEC 27002:2022, 8.15 y 8.16): el dueño ve dónde está
 * abierta cada cuenta y puede cerrar lo que no reconoce.
 */
export class DispositivoDeLaSesion1789000000000 implements MigrationInterface {
  name = 'DispositivoDeLaSesion1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD "ip" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD "user_agent" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sesiones" DROP COLUMN "user_agent"`);
    await queryRunner.query(`ALTER TABLE "sesiones" DROP COLUMN "ip"`);
  }
}
