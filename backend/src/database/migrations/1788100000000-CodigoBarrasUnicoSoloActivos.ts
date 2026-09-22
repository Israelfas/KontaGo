import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dar de baja un producto no lo borra (sus ventas pasadas lo siguen
 * referenciando), pero su código de barras tiene que quedar libre: si la
 * tienda vuelve a vender ese artículo, se carga como producto nuevo. Por
 * eso el código pasa a ser único solo entre productos ACTIVOS — que es lo
 * que importa para el escaneo, que ya filtra por activo.
 */
export class CodigoBarrasUnicoSoloActivos1788100000000 implements MigrationInterface {
  name = 'CodigoBarrasUnicoSoloActivos1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_productos_tenant_codigo_unico"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_productos_tenant_codigo_activo" ON "productos" ("tenant_id", "codigo_barras") WHERE "activo" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Si ya hay un código repetido entre un producto activo y uno dado de
    // baja, volver al índice anterior falla — igual que en
    // CodigoBarrasUnico, mejor fallar con claridad que a mitad de camino.
    const duplicados = (await queryRunner.query(`
      SELECT tenant_id, codigo_barras
      FROM productos
      GROUP BY tenant_id, codigo_barras
      HAVING COUNT(*) > 1
    `)) as unknown[];

    if (duplicados.length > 0) {
      throw new Error(
        `No se puede revertir: hay ${duplicados.length} código(s) de barras ` +
          `usados a la vez por un producto activo y uno dado de baja.`,
      );
    }

    await queryRunner.query(`DROP INDEX "IDX_productos_tenant_codigo_activo"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_productos_tenant_codigo_unico" ON "productos" ("tenant_id", "codigo_barras")`,
    );
  }
}
