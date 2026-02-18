/**
 * Migration: Soft Delete et Suppression de la Colonne _status
 *
 * Story 12.3: Implémenter le Soft Delete sur Toutes les Entités Backend (ADR-026 R4)
 *
 * Contexte :
 * - La colonne deletedAt (TIMESTAMPTZ NULL) a été ajoutée par la migration 12.2
 *   (1771400000000-MigrateEntityPKsToUUIDDomainGenerated.ts)
 * - La colonne _status ('active' | 'deleted') a été ajoutée par la migration sync
 *   (1739640000000-AddSyncColumnsAndTables.ts)
 *
 * Cette migration :
 * 1. Migre les données : enregistrements avec _status='deleted' → deletedAt renseigné
 * 2. Supprime la colonne _status de thoughts, ideas, todos
 *
 * BACKUP OBLIGATOIRE avant toute migration en production.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteAndRemoveStatusColumn1771500000000
  implements MigrationInterface
{
  name = 'SoftDeleteAndRemoveStatusColumn1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. thoughts : migrer _status='deleted' → deletedAt
    //    Les enregistrements 'active' conservent deletedAt=NULL
    // ============================================================
    await queryRunner.query(`
      UPDATE thoughts
      SET "deletedAt" = "updatedAt"
      WHERE _status = 'deleted'
        AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE thoughts DROP COLUMN IF EXISTS _status
    `);

    // ============================================================
    // 2. ideas : migrer _status='deleted' → deletedAt
    // ============================================================
    await queryRunner.query(`
      UPDATE ideas
      SET "deletedAt" = "updatedAt"
      WHERE _status = 'deleted'
        AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ideas DROP COLUMN IF EXISTS _status
    `);

    // ============================================================
    // 3. todos : migrer _status='deleted' → deletedAt
    // ============================================================
    await queryRunner.query(`
      UPDATE todos
      SET "deletedAt" = "updatedAt"
      WHERE _status = 'deleted'
        AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE todos DROP COLUMN IF EXISTS _status
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Rollback : remettre la colonne _status avec valeurs inférées
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE thoughts
      ADD COLUMN IF NOT EXISTS _status text NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      UPDATE thoughts SET _status = 'deleted' WHERE "deletedAt" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ideas
      ADD COLUMN IF NOT EXISTS _status text NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      UPDATE ideas SET _status = 'deleted' WHERE "deletedAt" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE todos
      ADD COLUMN IF NOT EXISTS _status text NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      UPDATE todos SET _status = 'deleted' WHERE "deletedAt" IS NOT NULL
    `);
  }
}
