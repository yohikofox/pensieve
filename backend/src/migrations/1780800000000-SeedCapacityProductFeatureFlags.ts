/**
 * Migration: Refactoring Feature Flags — Orientation Capacité Produit
 * Story 8.22: Remplacer les flags orientés composant UI par des flags
 * orientés capacité produit
 *
 * Opérations :
 *   1. Ajouter la colonne `deprecated` à la table `features`
 *   2. Insérer les 6 nouveaux flags (capacités produit)
 *   3. Marquer les 3 anciens flags comme dépréciés (pas de suppression — rollback possible)
 *   4. Copier les assignations user/role/permission vers les nouveaux flags
 *
 * UUIDs déterministes (préfixe fe = features) :
 *   fe000007 = news
 *   fe000008 = projects
 *   fe000009 = url_capture
 *   fe000010 = photo_capture
 *   fe000011 = document_capture
 *   fe000012 = clipboard_capture
 *
 * Flags existants dépréciés (non supprimés) :
 *   fe000003 = news_tab          → remplacé par news (fe000007)
 *   fe000004 = projects_tab      → remplacé par projects (fe000008)
 *   fe000005 = capture_media_buttons → remplacé par url/photo/document/clipboard
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCapacityProductFeatureFlags1780800000000 implements MigrationInterface {
  name = 'SeedCapacityProductFeatureFlags1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Task 1.2 prerequisite : Ajouter la colonne deprecated si absente
    await queryRunner.query(`
      ALTER TABLE "features"
      ADD COLUMN IF NOT EXISTS "deprecated" BOOLEAN NOT NULL DEFAULT false
    `);

    // Task 1.1 : Insérer les 6 nouveaux flags orientés capacité produit
    await queryRunner.query(`
      INSERT INTO "features" ("id", "key", "description", "default_value", "deprecated")
      VALUES
        ('fe000007-0000-7000-8000-000000000007', 'news',              'Accès à l''onglet et aux contenus Actualités',                  false, false),
        ('fe000008-0000-7000-8000-000000000008', 'projects',          'Accès à l''onglet et aux fonctionnalités Projets',               false, false),
        ('fe000009-0000-7000-8000-000000000009', 'url_capture',       'Capture et analyse de contenu depuis une URL',                  false, false),
        ('fe000010-0000-7000-8000-000000000010', 'photo_capture',     'Capture et analyse d''images ou photos',                        false, false),
        ('fe000011-0000-7000-8000-000000000011', 'document_capture',  'Capture et analyse de documents (PDF, etc.)',                   false, false),
        ('fe000012-0000-7000-8000-000000000012', 'clipboard_capture', 'Capture du contenu du presse-papier',                          false, false)
      ON CONFLICT ("key") DO NOTHING
    `);

    // Task 1.2 : Marquer les 3 anciens flags comme dépréciés
    await queryRunner.query(`
      UPDATE "features"
      SET "deprecated" = true
      WHERE "id" IN (
        'fe000003-0000-7000-8000-000000000003',
        'fe000004-0000-7000-8000-000000000004',
        'fe000005-0000-7000-8000-000000000005'
      )
    `);

    // Task 2.1 : Copier les assignations user — news_tab → news
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000007-0000-7000-8000-000000000007', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Task 2.1 : Copier les assignations user — projects_tab → projects
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000008-0000-7000-8000-000000000008', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Task 2.1 : Copier les assignations user — capture_media_buttons → url_capture
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000009-0000-7000-8000-000000000009', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Task 2.1 : Copier les assignations user — capture_media_buttons → photo_capture
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000010-0000-7000-8000-000000000010', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Task 2.1 : Copier les assignations user — capture_media_buttons → document_capture
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000011-0000-7000-8000-000000000011', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Task 2.1 : Copier les assignations user — capture_media_buttons → clipboard_capture
    await queryRunner.query(`
      INSERT INTO "user_feature_assignments" ("user_id", "feature_id", "value")
      SELECT "user_id", 'fe000012-0000-7000-8000-000000000012', "value"
      FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
      ON CONFLICT ("user_id", "feature_id") DO NOTHING
    `);

    // Copier les assignations role — news_tab → news
    await queryRunner.query(`
      INSERT INTO "role_feature_assignments" ("role_id", "feature_id", "value")
      SELECT "role_id", 'fe000007-0000-7000-8000-000000000007', "value"
      FROM "role_feature_assignments"
      WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
      ON CONFLICT ("role_id", "feature_id") DO NOTHING
    `);

    // Copier les assignations role — projects_tab → projects
    await queryRunner.query(`
      INSERT INTO "role_feature_assignments" ("role_id", "feature_id", "value")
      SELECT "role_id", 'fe000008-0000-7000-8000-000000000008', "value"
      FROM "role_feature_assignments"
      WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
      ON CONFLICT ("role_id", "feature_id") DO NOTHING
    `);

    // Copier les assignations role — capture_media_buttons → 4 nouveaux flags
    for (const newFeatureId of [
      'fe000009-0000-7000-8000-000000000009',
      'fe000010-0000-7000-8000-000000000010',
      'fe000011-0000-7000-8000-000000000011',
      'fe000012-0000-7000-8000-000000000012',
    ]) {
      await queryRunner.query(
        `INSERT INTO "role_feature_assignments" ("role_id", "feature_id", "value")
         SELECT "role_id", $1, "value"
         FROM "role_feature_assignments"
         WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
         ON CONFLICT ("role_id", "feature_id") DO NOTHING`,
        [newFeatureId],
      );
    }

    // Copier les assignations permission — news_tab → news
    await queryRunner.query(`
      INSERT INTO "permission_feature_assignments" ("permission_id", "feature_id", "value")
      SELECT "permission_id", 'fe000007-0000-7000-8000-000000000007', "value"
      FROM "permission_feature_assignments"
      WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
      ON CONFLICT ("permission_id", "feature_id") DO NOTHING
    `);

    // Copier les assignations permission — projects_tab → projects
    await queryRunner.query(`
      INSERT INTO "permission_feature_assignments" ("permission_id", "feature_id", "value")
      SELECT "permission_id", 'fe000008-0000-7000-8000-000000000008', "value"
      FROM "permission_feature_assignments"
      WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
      ON CONFLICT ("permission_id", "feature_id") DO NOTHING
    `);

    // Copier les assignations permission — capture_media_buttons → 4 nouveaux flags
    for (const newFeatureId of [
      'fe000009-0000-7000-8000-000000000009',
      'fe000010-0000-7000-8000-000000000010',
      'fe000011-0000-7000-8000-000000000011',
      'fe000012-0000-7000-8000-000000000012',
    ]) {
      await queryRunner.query(
        `INSERT INTO "permission_feature_assignments" ("permission_id", "feature_id", "value")
         SELECT "permission_id", $1, "value"
         FROM "permission_feature_assignments"
         WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
         ON CONFLICT ("permission_id", "feature_id") DO NOTHING`,
        [newFeatureId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer uniquement les assignations qui ont été COPIÉES par cette migration
    // (celles dont le sujet possède encore l'ancien flag source).
    // Les assignations créées manuellement APRÈS la migration sont préservées.

    // USER — news (fe000007) : supprimer seulement si le user a encore news_tab (fe000003)
    await queryRunner.query(`
      DELETE FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000007-0000-7000-8000-000000000007'
        AND "user_id" IN (
          SELECT "user_id" FROM "user_feature_assignments"
          WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
        )
    `);

    // USER — projects (fe000008) : supprimer seulement si le user a encore projects_tab (fe000004)
    await queryRunner.query(`
      DELETE FROM "user_feature_assignments"
      WHERE "feature_id" = 'fe000008-0000-7000-8000-000000000008'
        AND "user_id" IN (
          SELECT "user_id" FROM "user_feature_assignments"
          WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
        )
    `);

    // USER — 4 flags capture : supprimer seulement si le user a encore capture_media_buttons (fe000005)
    for (const newFeatureId of [
      'fe000009-0000-7000-8000-000000000009',
      'fe000010-0000-7000-8000-000000000010',
      'fe000011-0000-7000-8000-000000000011',
      'fe000012-0000-7000-8000-000000000012',
    ]) {
      await queryRunner.query(
        `DELETE FROM "user_feature_assignments"
         WHERE "feature_id" = $1
           AND "user_id" IN (
             SELECT "user_id" FROM "user_feature_assignments"
             WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
           )`,
        [newFeatureId],
      );
    }

    // ROLE — news (fe000007)
    await queryRunner.query(`
      DELETE FROM "role_feature_assignments"
      WHERE "feature_id" = 'fe000007-0000-7000-8000-000000000007'
        AND "role_id" IN (
          SELECT "role_id" FROM "role_feature_assignments"
          WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
        )
    `);

    // ROLE — projects (fe000008)
    await queryRunner.query(`
      DELETE FROM "role_feature_assignments"
      WHERE "feature_id" = 'fe000008-0000-7000-8000-000000000008'
        AND "role_id" IN (
          SELECT "role_id" FROM "role_feature_assignments"
          WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
        )
    `);

    // ROLE — 4 flags capture
    for (const newFeatureId of [
      'fe000009-0000-7000-8000-000000000009',
      'fe000010-0000-7000-8000-000000000010',
      'fe000011-0000-7000-8000-000000000011',
      'fe000012-0000-7000-8000-000000000012',
    ]) {
      await queryRunner.query(
        `DELETE FROM "role_feature_assignments"
         WHERE "feature_id" = $1
           AND "role_id" IN (
             SELECT "role_id" FROM "role_feature_assignments"
             WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
           )`,
        [newFeatureId],
      );
    }

    // PERMISSION — news (fe000007)
    await queryRunner.query(`
      DELETE FROM "permission_feature_assignments"
      WHERE "feature_id" = 'fe000007-0000-7000-8000-000000000007'
        AND "permission_id" IN (
          SELECT "permission_id" FROM "permission_feature_assignments"
          WHERE "feature_id" = 'fe000003-0000-7000-8000-000000000003'
        )
    `);

    // PERMISSION — projects (fe000008)
    await queryRunner.query(`
      DELETE FROM "permission_feature_assignments"
      WHERE "feature_id" = 'fe000008-0000-7000-8000-000000000008'
        AND "permission_id" IN (
          SELECT "permission_id" FROM "permission_feature_assignments"
          WHERE "feature_id" = 'fe000004-0000-7000-8000-000000000004'
        )
    `);

    // PERMISSION — 4 flags capture
    for (const newFeatureId of [
      'fe000009-0000-7000-8000-000000000009',
      'fe000010-0000-7000-8000-000000000010',
      'fe000011-0000-7000-8000-000000000011',
      'fe000012-0000-7000-8000-000000000012',
    ]) {
      await queryRunner.query(
        `DELETE FROM "permission_feature_assignments"
         WHERE "feature_id" = $1
           AND "permission_id" IN (
             SELECT "permission_id" FROM "permission_feature_assignments"
             WHERE "feature_id" = 'fe000005-0000-7000-8000-000000000005'
           )`,
        [newFeatureId],
      );
    }

    // Restaurer les 3 anciens flags (non dépréciés)
    await queryRunner.query(`
      UPDATE "features"
      SET "deprecated" = false
      WHERE "id" IN (
        'fe000003-0000-7000-8000-000000000003',
        'fe000004-0000-7000-8000-000000000004',
        'fe000005-0000-7000-8000-000000000005'
      )
    `);

    // Supprimer les 6 nouveaux flags
    await queryRunner.query(`
      DELETE FROM "features"
      WHERE "id" IN (
        'fe000007-0000-7000-8000-000000000007',
        'fe000008-0000-7000-8000-000000000008',
        'fe000009-0000-7000-8000-000000000009',
        'fe000010-0000-7000-8000-000000000010',
        'fe000011-0000-7000-8000-000000000011',
        'fe000012-0000-7000-8000-000000000012'
      )
    `);

    // Supprimer la colonne deprecated
    await queryRunner.query(`
      ALTER TABLE "features" DROP COLUMN IF EXISTS "deprecated"
    `);
  }
}
