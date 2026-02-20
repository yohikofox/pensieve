/**
 * Migration: Add 'processing' and 'ready' capture states
 *
 * Bugfix: La synchronisation backend écrase l'état local des captures.
 *
 * Le mobile utilise les états 'processing' et 'ready' pour la transcription,
 * mais ces états n'existaient pas dans la table référentielle capture_states.
 * TypeORM ignorait silencieusement les valeurs inconnues lors du PUSH,
 * ce qui empêchait la persistance de l'état de transcription.
 *
 * UUIDs déterministes (convention préfixe b = capture_states):
 *   processing = b0000000-0000-7000-8000-000000000004
 *   ready      = b0000000-0000-7000-8000-000000000005
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingAndReadyCaptureStates1772200000000 implements MigrationInterface {
  name = 'AddProcessingAndReadyCaptureStates1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "capture_states" ("id", "name", "label", "display_order", "is_active")
      VALUES
        ('b0000000-0000-7000-8000-000000000004', 'processing', 'En cours de transcription', 3, true),
        ('b0000000-0000-7000-8000-000000000005', 'ready',      'Prêt',                      4, true)
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "capture_states"
      WHERE "name" IN ('processing', 'ready')
    `);
  }
}
