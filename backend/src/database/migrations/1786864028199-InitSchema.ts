import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1786864028199 implements MigrationInterface {
    name = 'InitSchema1786864028199'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tenants_plan_enum" AS ENUM('gratuito', 'pago', 'enterprise')`);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(150) NOT NULL, "moneda" character varying(3) NOT NULL DEFAULT 'USD', "plan" "public"."tenants_plan_enum" NOT NULL DEFAULT 'gratuito', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('admin', 'cajero')`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "nombre" character varying(150) NOT NULL, "email" character varying(150) NOT NULL, "password_hash" character varying NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL DEFAULT 'cajero', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1f888a563fd811987449e29aa0" ON "usuarios"  ("tenant_id", "email") `);
        await queryRunner.query(`CREATE TABLE "productos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "codigo_barras" character varying(64) NOT NULL, "nombre" character varying(200) NOT NULL, "categoria" character varying(100), "proveedor" character varying(150), "precio_venta_centavos" integer NOT NULL, "costo_unitario_centavos" integer NOT NULL DEFAULT '0', "stock" integer NOT NULL DEFAULT '0', "stock_minimo" integer NOT NULL DEFAULT '0', "fecha_vencimiento" date, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_04f604609a0949a7f3b43400766" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b88bb0360eca1908d91627bee" ON "productos"  ("tenant_id", "codigo_barras") `);
        await queryRunner.query(`CREATE TABLE "ventas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "total_centavos" integer NOT NULL, "monto_recibido_centavos" integer NOT NULL, "vuelto_centavos" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8b73abe8561829c019531d9a2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ec7e16dd98e707f583479ded42" ON "ventas"  ("tenant_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "venta_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "venta_id" uuid NOT NULL, "producto_id" uuid NOT NULL, "cantidad" integer NOT NULL, "precio_venta_centavos" integer NOT NULL, "costo_unitario_centavos" integer NOT NULL, CONSTRAINT "PK_6506a1ae8240b069cab6a5c7c96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_7b664ae6b7cda3df230794ff6c1" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "productos" ADD CONSTRAINT "FK_510b416153d3da4180d0a82dfe5" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ventas" ADD CONSTRAINT "FK_76af321dc97591c0a668730f398" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ventas" ADD CONSTRAINT "FK_5c564fe8d2b5182a37211405827" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "venta_items" ADD CONSTRAINT "FK_85028d5f15f881b7bb95f61c293" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "venta_items" ADD CONSTRAINT "FK_0c5282608418ad8a536d318219d" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venta_items" DROP CONSTRAINT "FK_0c5282608418ad8a536d318219d"`);
        await queryRunner.query(`ALTER TABLE "venta_items" DROP CONSTRAINT "FK_85028d5f15f881b7bb95f61c293"`);
        await queryRunner.query(`ALTER TABLE "ventas" DROP CONSTRAINT "FK_5c564fe8d2b5182a37211405827"`);
        await queryRunner.query(`ALTER TABLE "ventas" DROP CONSTRAINT "FK_76af321dc97591c0a668730f398"`);
        await queryRunner.query(`ALTER TABLE "productos" DROP CONSTRAINT "FK_510b416153d3da4180d0a82dfe5"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_7b664ae6b7cda3df230794ff6c1"`);
        await queryRunner.query(`DROP TABLE "venta_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec7e16dd98e707f583479ded42"`);
        await queryRunner.query(`DROP TABLE "ventas"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b88bb0360eca1908d91627bee"`);
        await queryRunner.query(`DROP TABLE "productos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f888a563fd811987449e29aa0"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_plan_enum"`);
    }

}
