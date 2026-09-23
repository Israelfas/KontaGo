import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lotes por fecha de vencimiento (ver inventario/entities/lote.entity.ts).
 *
 * - lotes: unidades de un producto que vencen el mismo día.
 * - venta_item_lotes: de qué lote salió cada línea vendida, para que una
 *   anulación devuelva las unidades a su lote.
 * - movimientos_inventario.lote_id: el lote que entró o del que salió la
 *   pérdida.
 *
 * Datos existentes: la única fecha que tenía cada producto pasa a ser su
 * primer lote, con todo su stock. Un producto con fecha pero sin stock
 * queda sin fecha: no hay unidades que venzan (la fecha se carga de
 * nuevo al abastecer).
 */
export class Lotes1788400000000 implements MigrationInterface {
  name = 'Lotes1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "producto_id" uuid NOT NULL, "fecha_vencimiento" date, "cantidad" integer NOT NULL, "cantidad_inicial" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_lotes" PRIMARY KEY ("id"), CONSTRAINT "CHK_lotes_cantidad" CHECK ("cantidad" >= 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lotes_producto" ON "lotes" ("producto_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "lotes" ADD CONSTRAINT "FK_lotes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "lotes" ADD CONSTRAINT "FK_lotes_producto" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "venta_item_lotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "venta_item_id" uuid NOT NULL, "lote_id" uuid NOT NULL, "cantidad" integer NOT NULL, "cantidad_devuelta" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_venta_item_lotes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_venta_item_lotes_item" ON "venta_item_lotes" ("venta_item_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_item_lotes" ADD CONSTRAINT "FK_venta_item_lotes_item" FOREIGN KEY ("venta_item_id") REFERENCES "venta_items"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_item_lotes" ADD CONSTRAINT "FK_venta_item_lotes_lote" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" ADD "lote_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_movimientos_inventario_lote" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL`,
    );

    // La fecha única de cada producto → su primer lote.
    await queryRunner.query(
      `INSERT INTO "lotes" ("tenant_id", "producto_id", "fecha_vencimiento", "cantidad", "cantidad_inicial")
       SELECT "tenant_id", "id", "fecha_vencimiento", "stock", "stock"
       FROM "productos"
       WHERE "fecha_vencimiento" IS NOT NULL AND "stock" > 0`,
    );
    await queryRunner.query(
      `UPDATE "productos" SET "fecha_vencimiento" = NULL WHERE "fecha_vencimiento" IS NOT NULL AND "stock" <= 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Vuelve a una sola fecha por producto: la del lote que vence antes
    // (ya está guardada en productos.fecha_vencimiento).
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_movimientos_inventario_lote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" DROP COLUMN "lote_id"`,
    );
    await queryRunner.query(`DROP TABLE "venta_item_lotes"`);
    await queryRunner.query(`DROP TABLE "lotes"`);
  }
}
