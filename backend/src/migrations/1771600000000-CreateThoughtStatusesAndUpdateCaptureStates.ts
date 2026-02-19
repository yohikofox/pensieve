/**
 * Migration: Create thought_statuses table and complete capture_states
 *
 * Story 13.2: Tables référentielles pour les statuts backend (ADR-026 R2)
 *
 * Changements:
 * 1. Créer la table thought_statuses avec tous les champs requis
 * 2. Seed des valeurs 'active' et 'archived' avec UUIDs déterministes
 * 3. Ajouter label, display_order, is_active à capture_states
 * 4. Mettre à jour les capture_states existants avec leurs labels
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateThoughtStatusesAndUpdateCaptureStates1771600000000 implements MigrationInterface {
  name = 'CreateThoughtStatusesAndUpdateCaptureStates1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. Créer la table thought_statuses
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE "thought_statuses" (
        "id"            uuid            NOT NULL,
        "code"          varchar(50)     NOT NULL,
        "label"         varchar(100)    NOT NULL,
        "display_order" integer         NOT NULL DEFAULT 0,
        "is_active"     boolean         NOT NULL DEFAULT true,
        "createdAt"     timestamptz     NOT NULL DEFAULT now(),
        "updatedAt"     timestamptz     NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_thought_statuses_code" UNIQUE ("code"),
        CONSTRAINT "PK_thought_statuses" PRIMARY KEY ("id")
      )
    `);

    // ============================================================
    // 2. Seed des valeurs référentielles — idempotent (ON CONFLICT DO NOTHING)
    //    UUIDs déterministes (référence: reference-data.constants.ts)
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "thought_statuses" ("id", "code", "label", "display_order", "is_active")
      VALUES
        ('d0000000-0000-7000-8000-000000000001', 'active',   'Actif',   0, true),
        ('d0000000-0000-7000-8000-000000000002', 'archived', 'Archivé', 1, true)
      ON CONFLICT ("id") DO NOTHING
    `);

    // ============================================================
    // 3. Ajouter les colonnes manquantes à capture_states
    //    Nullable d'abord pour compatibilité avec les données existantes
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "capture_states"
        ADD COLUMN IF NOT EXISTS "label"         varchar(100),
        ADD COLUMN IF NOT EXISTS "display_order" integer,
        ADD COLUMN IF NOT EXISTS "is_active"     boolean
    `);

    // ============================================================
    // 4. Remplir les labels pour les capture_states existants
    //    Basé sur le champ "name" existant
    // ============================================================
    await queryRunner.query(`
      UPDATE "capture_states" SET
        "label"         = CASE "name"
                            WHEN 'recording' THEN 'En cours d''enregistrement'
                            WHEN 'captured'  THEN 'Capturé'
                            WHEN 'failed'    THEN 'Échoué'
                            ELSE "name"
                          END,
        "display_order" = CASE "name"
                            WHEN 'recording' THEN 0
                            WHEN 'captured'  THEN 1
                            WHEN 'failed'    THEN 2
                            ELSE 99
                          END,
        "is_active"     = true
      WHERE "label" IS NULL
    `);

    // ============================================================
    // 5. Passer les colonnes en NOT NULL maintenant qu'elles sont remplies
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "capture_states"
        ALTER COLUMN "label"         SET NOT NULL,
        ALTER COLUMN "label"         SET DEFAULT '',
        ALTER COLUMN "display_order" SET NOT NULL,
        ALTER COLUMN "display_order" SET DEFAULT 0,
        ALTER COLUMN "is_active"     SET NOT NULL,
        ALTER COLUMN "is_active"     SET DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Rollback: retirer les colonnes de capture_states, supprimer thought_statuses
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "capture_states"
        DROP COLUMN IF EXISTS "label",
        DROP COLUMN IF EXISTS "display_order",
        DROP COLUMN IF EXISTS "is_active"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "thought_statuses"`);
  }
}
