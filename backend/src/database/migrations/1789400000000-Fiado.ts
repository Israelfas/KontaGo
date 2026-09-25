import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fiado: vender a crédito a clientes de confianza y anotar sus abonos.
 *
 * - clientes: a quién se le fía.
 * - ventas.metodo_pago gana 'fiado', y ventas.cliente_id dice a quién.
 * - abonos_fiado: los pagos de esa deuda (en efectivo, entran a la caja
 *   como un ingreso del turno de quien lo recibe).
 */
export class Fiado1789400000000 implements MigrationInterface {
  name = 'Fiado1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "clientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "nombre" character varying(120) NOT NULL, "telefono" character varying(30), "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_clientes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clientes_tenant" ON "clientes" ("tenant_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ADD CONSTRAINT "FK_clientes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."ventas_metodo_pago_enum" ADD VALUE IF NOT EXISTS 'fiado'`,
    );
    await queryRunner.query(`ALTER TABLE "ventas" ADD "cliente_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "ventas" ADD CONSTRAINT "FK_ventas_cliente" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ventas_cliente" ON "ventas" ("cliente_id") WHERE "cliente_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."abonos_fiado_metodo_pago_enum" AS ENUM('efectivo', 'transferencia')`,
    );
    await queryRunner.query(
      `CREATE TABLE "abonos_fiado" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "cliente_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "monto_centavos" integer NOT NULL, "metodo_pago" "public"."abonos_fiado_metodo_pago_enum" NOT NULL, "turno_id" uuid, "nota" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_abonos_fiado" PRIMARY KEY ("id"), CONSTRAINT "CHK_abonos_fiado_monto" CHECK ("monto_centavos" > 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abonos_fiado_cliente" ON "abonos_fiado" ("cliente_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "abonos_fiado" ADD CONSTRAINT "FK_abonos_fiado_cliente" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "abonos_fiado" ADD CONSTRAINT "FK_abonos_fiado_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "abonos_fiado"`);
    await queryRunner.query(
      `DROP TYPE "public"."abonos_fiado_metodo_pago_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" DROP CONSTRAINT "FK_ventas_cliente"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ventas_cliente"`);
    await queryRunner.query(`ALTER TABLE "ventas" DROP COLUMN "cliente_id"`);
    // Postgres no quita valores de un enum: las ventas al fiado que
    // quedaran pasan a transferencia y el tipo se rehace sin 'fiado'.
    await queryRunner.query(
      `UPDATE "ventas" SET "metodo_pago" = 'transferencia' WHERE "metodo_pago" = 'fiado'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ventas_metodo_pago_enum" RENAME TO "ventas_metodo_pago_enum_viejo"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ventas_metodo_pago_enum" AS ENUM('efectivo', 'transferencia')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "metodo_pago" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "metodo_pago" TYPE "public"."ventas_metodo_pago_enum" USING "metodo_pago"::text::"public"."ventas_metodo_pago_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "metodo_pago" SET DEFAULT 'efectivo'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."ventas_metodo_pago_enum_viejo"`,
    );
    await queryRunner.query(`DROP TABLE "clientes"`);
  }
}
