import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Venta por peso: arroz, azúcar o queso por libra (o kilo).
 *
 * - productos.unidad: cómo se vende (unidad, libra, kilo). Los que ya
 *   existen quedan "por unidad", como siempre.
 * - Las cantidades pasan de integer a numeric(12,3): hasta milésimas de
 *   libra. Los valores que ya estaban no cambian (3 sigue siendo 3).
 */
const CANTIDADES: [string, string][] = [
  ['productos', 'stock'],
  ['productos', 'stock_minimo'],
  ['lotes', 'cantidad'],
  ['lotes', 'cantidad_inicial'],
  ['movimientos_inventario', 'cantidad'],
  ['venta_items', 'cantidad'],
  ['venta_items', 'cantidad_anulada'],
  ['venta_item_lotes', 'cantidad'],
  ['venta_item_lotes', 'cantidad_devuelta'],
];

export class VentaPorPeso1789300000000 implements MigrationInterface {
  name = 'VentaPorPeso1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."productos_unidad_enum" AS ENUM('unidad', 'libra', 'kilo')`,
    );
    await queryRunner.query(
      `ALTER TABLE "productos" ADD "unidad" "public"."productos_unidad_enum" NOT NULL DEFAULT 'unidad'`,
    );
    for (const [tabla, columna] of CANTIDADES) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE numeric(12,3)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Vuelve a enteros: lo vendido por peso se redondea.
    for (const [tabla, columna] of CANTIDADES) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE integer USING round("${columna}")::integer`,
      );
    }
    await queryRunner.query(`ALTER TABLE "productos" DROP COLUMN "unidad"`);
    await queryRunner.query(`DROP TYPE "public"."productos_unidad_enum"`);
  }
}
