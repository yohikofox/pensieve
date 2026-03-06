/**
 * Migration: No-op — colonnes déjà en snake_case
 *
 * La migration 1780100000000 avait déjà créé les colonnes en snake_case
 * ("created_at", "updated_at", "deleted_at"). Le renommage est inutile.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameFeatureTimestampColumns1780500000000 implements MigrationInterface {
  name = 'RenameFeatureTimestampColumns1780500000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op: colonnes déjà en snake_case depuis 1780100000000
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
