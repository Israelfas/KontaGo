import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Número de ticket: cada tienda numera sus ventas 1, 2, 3… sin saltos.
 *
 * - tenants.ultimo_numero_venta: el contador. Se incrementa dentro de la
 *   transacción de cada venta (UPDATE … RETURNING), así dos ventas a la
 *   vez nunca reciben el mismo número y una venta que falla no gasta uno.
 * - ventas.numero: único por tienda.
 *
 * Las ventas que ya existían se numeran por fecha, de la más vieja a la
 * más nueva, y el contador de cada tienda queda en su última.
 */
export class NumeroDeVenta1788700000000 implements MigrationInterface {
  name = 'NumeroDeVenta1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "ultimo_numero_venta" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "ventas" ADD "numero" integer`);
    await queryRunner.query(
      `UPDATE "ventas" v SET "numero" = n.numero
         FROM (SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS numero
                 FROM "ventas") n
        WHERE v.id = n.id`,
    );
    await queryRunner.query(
      `UPDATE "tenants" t SET "ultimo_numero_venta" = coalesce(
         (SELECT max("numero") FROM "ventas" v WHERE v.tenant_id = t.id), 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "numero" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ventas_tenant_numero" ON "ventas" ("tenant_id", "numero")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ventas_tenant_numero"`);
    await queryRunner.query(`ALTER TABLE "ventas" DROP COLUMN "numero"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "ultimo_numero_venta"`,
    );
  }
}
