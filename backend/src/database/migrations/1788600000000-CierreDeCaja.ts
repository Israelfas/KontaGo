import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierre de caja (arqueo):
 * - turnos_caja: el turno de cada cajero, con el fondo inicial y, al
 *   cerrar, el efectivo esperado y el contado.
 * - movimientos_caja: retiros e ingresos de efectivo durante el turno.
 * - ventas.metodo_pago: efectivo o transferencia (solo el efectivo entra
 *   al arqueo). Las ventas de antes quedan como efectivo, que era lo único.
 * - ventas.turno_id: en qué turno se cobró. Las de antes no tienen turno.
 */
export class CierreDeCaja1788600000000 implements MigrationInterface {
  name = 'CierreDeCaja1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "turnos_caja" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "fondo_inicial_centavos" integer NOT NULL, "abierto_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cerrado_en" TIMESTAMP WITH TIME ZONE, "cerrado_por_id" uuid, "efectivo_esperado_centavos" integer, "efectivo_contado_centavos" integer, "nota" character varying(300), CONSTRAINT "PK_turnos_caja" PRIMARY KEY ("id"), CONSTRAINT "CHK_turnos_caja_fondo" CHECK ("fondo_inicial_centavos" >= 0))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_turnos_caja_abierto_por_usuario" ON "turnos_caja" ("usuario_id") WHERE "cerrado_en" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_turnos_caja_tenant_apertura" ON "turnos_caja" ("tenant_id", "abierto_en")`,
    );
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ADD CONSTRAINT "FK_turnos_caja_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ADD CONSTRAINT "FK_turnos_caja_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "turnos_caja" ADD CONSTRAINT "FK_turnos_caja_cerrado_por" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_caja_tipo_enum" AS ENUM('retiro', 'ingreso')`,
    );
    await queryRunner.query(
      `CREATE TABLE "movimientos_caja" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "turno_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "tipo" "public"."movimientos_caja_tipo_enum" NOT NULL, "monto_centavos" integer NOT NULL, "motivo" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_movimientos_caja" PRIMARY KEY ("id"), CONSTRAINT "CHK_movimientos_caja_monto" CHECK ("monto_centavos" > 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_caja_turno" ON "movimientos_caja" ("turno_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_caja" ADD CONSTRAINT "FK_movimientos_caja_turno" FOREIGN KEY ("turno_id") REFERENCES "turnos_caja"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_caja" ADD CONSTRAINT "FK_movimientos_caja_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."ventas_metodo_pago_enum" AS ENUM('efectivo', 'transferencia')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ADD "metodo_pago" "public"."ventas_metodo_pago_enum" NOT NULL DEFAULT 'efectivo'`,
    );
    await queryRunner.query(`ALTER TABLE "ventas" ADD "turno_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ventas_turno" ON "ventas" ("turno_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ADD CONSTRAINT "FK_ventas_turno" FOREIGN KEY ("turno_id") REFERENCES "turnos_caja"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ventas" DROP CONSTRAINT "FK_ventas_turno"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ventas_turno"`);
    await queryRunner.query(`ALTER TABLE "ventas" DROP COLUMN "turno_id"`);
    await queryRunner.query(`ALTER TABLE "ventas" DROP COLUMN "metodo_pago"`);
    await queryRunner.query(`DROP TYPE "public"."ventas_metodo_pago_enum"`);
    await queryRunner.query(`DROP TABLE "movimientos_caja"`);
    await queryRunner.query(`DROP TYPE "public"."movimientos_caja_tipo_enum"`);
    await queryRunner.query(`DROP TABLE "turnos_caja"`);
  }
}
