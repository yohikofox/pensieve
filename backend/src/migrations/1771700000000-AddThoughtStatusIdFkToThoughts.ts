/**
 * Migration: Add status_id FK to thoughts table
 *
 * Story 13.2: Tables référentielles pour les statuts backend (ADR-026 R2)
 *
 * Prérequis: Migration 1771600000000 (thought_statuses doit exister)
 *
 * Changements:
 * 1. Ajouter colonne status_id UUID à thoughts
 * 2. Migrer les données existantes: status_id = UUID('active')
 * 3. Contraindre NOT NULL
 * 4. Ajouter FK ON DELETE RESTRICT
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

const THOUGHT_STATUS_ACTIVE_UUID = 'd0000000-0000-7000-8000-000000000001';

export class AddThoughtStatusIdFkToThoughts1771700000000 implements MigrationInterface {
  name = 'AddThoughtStatusIdFkToThoughts1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. Ajouter status_id nullable (pour la migration de données)
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "thoughts"
        ADD COLUMN IF NOT EXISTS "status_id" uuid
    `);

    // ============================================================
    // 2. Migrer les données existantes → 'active' par défaut
    //    (Story 12.3 a supprimé le cas 'deleted' via deletedAt)
    // ============================================================
    await queryRunner.query(`
      UPDATE "thoughts"
      SET "status_id" = '${THOUGHT_STATUS_ACTIVE_UUID}'::uuid
      WHERE "status_id" IS NULL
    `);

    // ============================================================
    // 3. Passer status_id en NOT NULL
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "thoughts"
        ALTER COLUMN "status_id" SET NOT NULL
    `);

    // ============================================================
    // 4. Ajouter la contrainte FK (ON DELETE RESTRICT — ADR-026 R2)
    //    Un statut ne peut pas être supprimé s'il est utilisé
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "thoughts"
        ADD CONSTRAINT "FK_thoughts_status_id"
        FOREIGN KEY ("status_id")
        REFERENCES "thought_statuses"("id")
        ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Rollback: supprimer la FK et la colonne
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "thoughts"
        DROP CONSTRAINT IF EXISTS "FK_thoughts_status_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "thoughts"
        DROP COLUMN IF EXISTS "status_id"
    `);
  }
}
