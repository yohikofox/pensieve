/**
 * Migration: Renommage des colonnes timestamp de la table features
 *
 * Correction de la migration 1780100000000 qui avait créé les colonnes en
 * camelCase ("createdAt", "updatedAt", "deletedAt") au lieu de snake_case.
 * AppBaseEntity déclare désormais name: 'created_at' etc. — on aligne la DB.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameFeatureTimestampColumns1780500000000 implements MigrationInterface {
  name = 'RenameFeatureTimestampColumns1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "updatedAt" TO "updated_at"`);
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "deletedAt" TO "deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_FEATURES_DELETED_AT"`);
    await queryRunner.query(`CREATE INDEX "IDX_FEATURES_DELETED_AT" ON "features" ("deleted_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_FEATURES_DELETED_AT"`);
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "updated_at" TO "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "features" RENAME COLUMN "deleted_at" TO "deletedAt"`);
    await queryRunner.query(`CREATE INDEX "IDX_FEATURES_DELETED_AT" ON "features" ("deletedAt")`);
  }
}
