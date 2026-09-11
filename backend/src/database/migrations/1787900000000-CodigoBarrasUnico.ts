    import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El índice (tenantId, codigoBarras) original no era único — nada
 * impedía crear dos productos con el mismo código de barras en la misma
 * tienda, y el escaneo (findOne) habría devuelto uno al azar entre los
 * duplicados. Antes de aplicar la restricción, verificamos que no haya
 * duplicados ya cargados; si los hay, la migración falla a propósito
 * con un mensaje claro en vez de aplicar una restricción que rompería
 * la base a mitad de camino.
 */
export class CodigoBarrasUnico1787900000000 implements MigrationInterface {
  name = 'CodigoBarrasUnico1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicados = (await queryRunner.query(`
      SELECT tenant_id, codigo_barras, COUNT(*) as cantidad
      FROM productos
      GROUP BY tenant_id, codigo_barras
      HAVING COUNT(*) > 1
    `)) as unknown[];

    if (duplicados.length > 0) {
      throw new Error(
        `No se puede aplicar la restricción de código de barras único: ` +
          `hay ${duplicados.length} código(s) de barras duplicados en la tabla productos. ` +
          `Hay que resolverlos a mano (borrar o cambiar el código de los duplicados) antes de reintentar esta migración.`,
      );
    }

    await queryRunner.query(`DROP INDEX "IDX_9b88bb0360eca1908d91627bee"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_productos_tenant_codigo_unico" ON "productos" ("tenant_id", "codigo_barras")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_productos_tenant_codigo_unico"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_9b88bb0360eca1908d91627bee" ON "productos" ("tenant_id", "codigo_barras")`,
    );
  }
}