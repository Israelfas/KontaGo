import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Anulación de ventas (total o por producto). Una venta anulada no se
 * borra ni se reescribe: el ticket original queda como se cobró, y lo
 * anulado se guarda aparte —
 * - venta_items.cantidad_anulada / iva_anulado_centavos: cuánto de cada
 *   línea se anuló (los reportes usan cantidad - cantidad_anulada).
 * - ventas.total_anulado_centavos: plata devuelta al cliente, acumulada.
 * - anulaciones_venta: registro de cada anulación (quién, cuándo, por qué
 *   y qué), para auditar.
 */
export class AnulacionVentas1788200000000 implements MigrationInterface {
  name = 'AnulacionVentas1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venta_items" ADD "cantidad_anulada" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_items" ADD "iva_anulado_centavos" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ADD "total_anulado_centavos" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE TABLE "anulaciones_venta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "venta_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "motivo" character varying(300) NOT NULL, "monto_devuelto_centavos" integer NOT NULL, "detalle" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_anulaciones_venta" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_anulaciones_venta_venta" ON "anulaciones_venta" ("venta_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "anulaciones_venta" ADD CONSTRAINT "FK_anulaciones_venta_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "anulaciones_venta" ADD CONSTRAINT "FK_anulaciones_venta_venta" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "anulaciones_venta" ADD CONSTRAINT "FK_anulaciones_venta_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "anulaciones_venta"`);
    await queryRunner.query(
      `ALTER TABLE "ventas" DROP COLUMN "total_anulado_centavos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_items" DROP COLUMN "iva_anulado_centavos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta_items" DROP COLUMN "cantidad_anulada"`,
    );
  }
}
