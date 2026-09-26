import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Desde cuándo valen las sesiones de cada usuario: se anota al cortarlas
 * todas (cambio de contraseña, desactivación, "cerrar en todos lados"), y
 * un ingreso verificado antes ya no puede crear una sesión nueva.
 */
export class SesionesValidasDesde1789600000000 implements MigrationInterface {
  name = 'SesionesValidasDesde1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "sesiones_validas_desde" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "sesiones_validas_desde"`,
    );
  }
}
