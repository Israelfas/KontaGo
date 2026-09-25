import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ventas hechas sin conexión: la app las guarda y las manda cuando vuelve
 * internet. Cada una lleva una clave que genera el celular; si llega dos
 * veces (se cortó justo cuando el servidor respondía), la segunda devuelve
 * la misma venta en vez de cobrar de nuevo.
 */
export class VentasSinConexion1789100000000 implements MigrationInterface {
  name = 'VentasSinConexion1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ventas" ADD "clave_idempotencia" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ventas_tenant_clave" ON "ventas" ("tenant_id", "clave_idempotencia") WHERE "clave_idempotencia" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ventas_tenant_clave"`);
    await queryRunner.query(
      `ALTER TABLE "ventas" DROP COLUMN "clave_idempotencia"`,
    );
  }
}
