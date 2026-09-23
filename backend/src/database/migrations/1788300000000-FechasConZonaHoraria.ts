import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las columnas de fecha eran "timestamp without time zone". La base las
 * llena con now() en la zona de su sesión (UTC en el contenedor), pero el
 * driver de Node las lee como hora LOCAL del servidor (Ecuador, UTC-5):
 * cada registro quedaba 5 horas en el futuro. Una venta a las 20:00
 * figuraba a la 01:00 del día siguiente, así que todo lo vendido después
 * de las 19:00 caía en el cierre de mañana (y se podía anular mañana).
 *
 * Con "timestamptz" se guarda el instante exacto y el driver lo devuelve
 * bien, sin importar la zona horaria de la base ni del servidor.
 *
 * Los valores existentes se escribieron con now() en UTC, así que se
 * interpretan como UTC al convertir.
 */
const COLUMNAS: [string, string][] = [
  ['tenants', 'created_at'],
  ['tenants', 'updated_at'],
  ['usuarios', 'created_at'],
  ['usuarios', 'updated_at'],
  ['productos', 'created_at'],
  ['productos', 'updated_at'],
  ['ventas', 'created_at'],
  ['movimientos_inventario', 'created_at'],
  ['anulaciones_venta', 'created_at'],
];

export class FechasConZonaHoraria1788300000000 implements MigrationInterface {
  name = 'FechasConZonaHoraria1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of COLUMNAS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE timestamptz USING "${columna}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of COLUMNAS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE timestamp USING "${columna}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
