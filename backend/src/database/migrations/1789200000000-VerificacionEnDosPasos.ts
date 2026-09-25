import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Verificación en dos pasos (ISO/IEC 27002:2022, 8.5): además de la
 * contraseña, un código de 6 dígitos de una app autenticadora.
 *
 * - dos_pasos_secreto: el secreto, cifrado (ver common/seguridad/cifrado).
 * - dos_pasos_pendiente: el que se está configurando, hasta confirmarlo.
 * - dos_pasos_activo_desde: null = no la usa.
 * - dos_pasos_ultimo_paso: el último código aceptado no sirve otra vez.
 * - dos_pasos_codigos: códigos de recuperación, solo su hash.
 */
export class VerificacionEnDosPasos1789200000000 implements MigrationInterface {
  name = 'VerificacionEnDosPasos1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "dos_pasos_secreto" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "dos_pasos_pendiente" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "dos_pasos_activo_desde" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "dos_pasos_ultimo_paso" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "dos_pasos_codigos" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "dos_pasos_codigos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "dos_pasos_ultimo_paso"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "dos_pasos_activo_desde"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "dos_pasos_pendiente"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "dos_pasos_secreto"`,
    );
  }
}
