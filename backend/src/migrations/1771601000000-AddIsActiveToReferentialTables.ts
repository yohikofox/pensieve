import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration corrective : ajoute la colonne `is_active` manquante sur les tables référentielles.
 *
 * Contexte : La migration 1771400000000 a ajouté createdAt/updatedAt/deletedAt aux tables
 * référentielles, mais BaseReferentialEntity attend `is_active` (pas `deletedAt`).
 *
 * Tables corrigées :
 * - capture_sync_statuses
 * - capture_types
 * - capture_states
 * - thought_statuses (créée par 1771600000000 — doit s'exécuter après)
 */
export class AddIsActiveToReferentialTables1771601000000 implements MigrationInterface {
  name = 'AddIsActiveToReferentialTables1771601000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await queryRunner.query(`
      ALTER TABLE capture_types
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await queryRunner.query(`
      ALTER TABLE capture_states
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await queryRunner.query(`
      ALTER TABLE thought_statuses
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE thought_statuses DROP COLUMN IF EXISTS is_active
    `);

    await queryRunner.query(`
      ALTER TABLE capture_states DROP COLUMN IF EXISTS is_active
    `);

    await queryRunner.query(`
      ALTER TABLE capture_types DROP COLUMN IF EXISTS is_active
    `);

    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses DROP COLUMN IF EXISTS is_active
    `);
  }
}
