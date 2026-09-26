import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El efectivo esperado y el contado de un turno pasan a bigint: con
 * integer, un turno con muchos ingresos superaba 2.147.483.647 centavos y
 * el cierre fallaba (y con él el listado de cajas y el reporte).
 */
export class EfectivoEnBigint1789500000000 implements MigrationInterface {
  name = 'EfectivoEnBigint1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ALTER COLUMN "efectivo_esperado_centavos" TYPE bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ALTER COLUMN "efectivo_contado_centavos" TYPE bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ALTER COLUMN "efectivo_contado_centavos" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ALTER COLUMN "efectivo_esperado_centavos" TYPE integer`,
    );
  }
}
