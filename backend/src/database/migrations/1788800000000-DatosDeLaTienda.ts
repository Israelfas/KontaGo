import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos de la tienda para el ticket (y, más adelante, la factura
 * electrónica): razón social, RUC, dirección, teléfono y un mensaje para
 * el pie del ticket. Todos opcionales.
 */
export class DatosDeLaTienda1788800000000 implements MigrationInterface {
  name = 'DatosDeLaTienda1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "razon_social" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "ruc" character varying(13)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "direccion" character varying(250)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "telefono" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "mensaje_ticket" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const columna of [
      'mensaje_ticket',
      'telefono',
      'direccion',
      'ruc',
      'razon_social',
    ]) {
      await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "${columna}"`);
    }
  }
}
