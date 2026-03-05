/**
 * Migration: Seed du feature flag live_transcription
 * Story 8.21: Feature Flag — Transcription Live (OFF par défaut)
 *
 * Insère la feature `live_transcription` dans la table "features" :
 *   - Contrôle la visibilité du bouton "Live" dans CaptureScreen
 *   - OFF par défaut (default_value: false)
 *   - Aucune assignation user/role/permission créée par défaut
 *
 * UUID déterministe (préfixe fe = features) :
 *   fe000006 = live_transcription
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedLiveTranscriptionFeature1780700000000
  implements MigrationInterface
{
  name = 'SeedLiveTranscriptionFeature1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "features" ("id", "key", "description", "default_value")
      VALUES (
        'fe000006-0000-7000-8000-000000000006',
        'live_transcription',
        'Active le bouton de transcription en temps réel dans CaptureScreen',
        false
      )
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "features"
      WHERE "key" = 'live_transcription'
    `);
  }
}
