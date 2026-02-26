/**
 * Migration: Seed des features initiales
 * Story 24.1: Feature Flag System (AC2)
 *
 * Insère les 5 features initiales dans la table "features" :
 *   - debug_mode           : Accès au mode debug
 *   - data_mining          : Accès au query builder / data mining
 *   - news_tab             : Onglet Actualités dans l'app
 *   - projects_tab         : Onglet Projets dans l'app
 *   - capture_media_buttons: Boutons média sur l'écran de capture
 *
 * UUIDs déterministes (préfixe fe = features) :
 *   fe000001 = debug_mode
 *   fe000002 = data_mining
 *   fe000003 = news_tab
 *   fe000004 = projects_tab
 *   fe000005 = capture_media_buttons
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialFeatures1780200000000 implements MigrationInterface {
  name = 'SeedInitialFeatures1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "features" ("id", "key", "description", "default_value")
      VALUES
        ('fe000001-0000-7000-8000-000000000001', 'debug_mode',            'Accès au mode debug de l''application',       false),
        ('fe000002-0000-7000-8000-000000000002', 'data_mining',           'Accès au query builder / data mining',        false),
        ('fe000003-0000-7000-8000-000000000003', 'news_tab',              'Affichage de l''onglet Actualités',            false),
        ('fe000004-0000-7000-8000-000000000004', 'projects_tab',          'Affichage de l''onglet Projets',               false),
        ('fe000005-0000-7000-8000-000000000005', 'capture_media_buttons', 'Boutons média sur l''écran de capture',        false)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "features"
      WHERE "key" IN ('debug_mode', 'data_mining', 'news_tab', 'projects_tab', 'capture_media_buttons')
    `);
  }
}
