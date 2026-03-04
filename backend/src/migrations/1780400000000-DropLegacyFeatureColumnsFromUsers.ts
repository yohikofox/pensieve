/**
 * Migration: Suppression des colonnes legacy debug_mode_access et data_mining_access
 * Story 24.1: Feature Flag System (AC3)
 *
 * Après backfill (migration 1780300000000), les colonnes legacy ne sont plus
 * nécessaires. Cette migration les supprime pour nettoyer le schéma.
 *
 * Rollback : restaure les colonnes et recopie les valeurs depuis
 * user_feature_assignments (inverse du backfill).
 *
 * ATTENTION : Exécuter APRÈS 1780300000000-BackfillFeatureFlagsFromUserColumns.ts
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyFeatureColumnsFromUsers1780400000000 implements MigrationInterface {
  name = 'DropLegacyFeatureColumnsFromUsers1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "debug_mode_access"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "data_mining_access"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaure les colonnes avec valeur par défaut false
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "debug_mode_access"  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "data_mining_access" BOOLEAN NOT NULL DEFAULT false
    `);

    // Recopie les valeurs depuis user_feature_assignments
    await queryRunner.query(`
      UPDATE "users" u
      SET debug_mode_access = true
      FROM "user_feature_assignments" ufa
      WHERE ufa.user_id = u.id
        AND ufa.feature_id = 'fe000001-0000-7000-8000-000000000001'
        AND ufa.value = true
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET data_mining_access = true
      FROM "user_feature_assignments" ufa
      WHERE ufa.user_id = u.id
        AND ufa.feature_id = 'fe000002-0000-7000-8000-000000000002'
        AND ufa.value = true
    `);
  }
}
