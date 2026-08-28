import { MigrationInterface, QueryRunner } from 'typeorm';

export class Iva1787400000000 implements MigrationInterface {
  name = 'Iva1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "productos" ADD "iva_exento" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_items" ADD "iva_centavos" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venta_items" DROP COLUMN "iva_centavos"`,
    );
    await queryRunner.query(`ALTER TABLE "productos" DROP COLUMN "iva_exento"`);
  }
}
