/**
 * Migration: Backfill des feature flags depuis les colonnes legacy de users
 * Story 24.1: Feature Flag System (AC3)
 *
 * Migre les valeurs existantes de :
 *   - users.debug_mode_access = true  → user_feature_assignments (feature: debug_mode, value: true)
 *   - users.data_mining_access = true → user_feature_assignments (feature: data_mining, value: true)
 *
 * Seules les valeurs true sont backfillées — les false ne créent pas d'assignation
 * (absence d'assignation = false par défaut dans l'algorithme deny-wins).
 *
 * Rollback : supprime TOUTES les assignations pour debug_mode et data_mining
 * (UUIDs déterministes). Limitation connue : ce rollback ne peut pas distinguer
 * les assignations créées par le backfill de celles créées ultérieurement par
 * l'application. À exécuter uniquement si migration 1780400000000.down()
 * a déjà été appliquée (les colonnes users doivent être restaurées en premier).
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillFeatureFlagsFromUserColumns1780300000000 implements MigrationInterface {
  name = 'BackfillFeatureFlagsFromUserColumns1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill debug_mode_access = true → user_feature_assignments
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT u.id,
             'fe000001-0000-7000-8000-000000000001',
             true
      FROM "users" u
      WHERE u.debug_mode_access = true
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Backfill data_mining_access = true → user_feature_assignments
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT u.id,
             'fe000002-0000-7000-8000-000000000002',
             true
      FROM "users" u
      WHERE u.data_mining_access = true
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaure les colonnes users (down migration 1780400000000 doit être exécutée avant)
    // Supprime les assignations créées par ce backfill
    await queryRunner.query(`
      DELETE FROM "user_feature_assignments"
      WHERE "feature_id" IN (
        'fe000001-0000-7000-8000-000000000001',
        'fe000002-0000-7000-8000-000000000002'
      )
    `);
  }
}
