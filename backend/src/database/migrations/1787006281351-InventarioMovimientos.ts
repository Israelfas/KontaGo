import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventarioMovimientos1787006281351 implements MigrationInterface {
  name = 'InventarioMovimientos1787006281351';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_inventario_tipo_enum" AS ENUM('abastecimiento', 'merma')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_inventario_motivo_enum" AS ENUM('vencido', 'danado', 'robado', 'otro')`,
    );
    await queryRunner.query(
      `CREATE TABLE "movimientos_inventario" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "producto_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "tipo" "public"."movimientos_inventario_tipo_enum" NOT NULL, "cantidad" integer NOT NULL, "costo_unitario_centavos" integer NOT NULL, "proveedor" character varying(150), "motivo" "public"."movimientos_inventario_motivo_enum", "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_812f6e4f95b017981363c4b9ff9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0dc3a858e3609fce64922d758" ON "movimientos_inventario"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_4a43f1ac97e13b6db7b401fe173" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_34e722a39e30087fa624b5955d" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_34e722a39e30087fa624b5955d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_4a43f1ac97e13b6db7b401fe173"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0dc3a858e3609fce64922d758"`,
    );
    await queryRunner.query(`DROP TABLE "movimientos_inventario"`);
    await queryRunner.query(
      `DROP TYPE "public"."movimientos_inventario_motivo_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."movimientos_inventario_tipo_enum"`,
    );
  }
}
