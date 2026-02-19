/**
 * Migration: Add BaseEntity columns to captures table
 *
 * Story 12.1: Créer la BaseEntity Partagée Backend (ADR-026 R6)
 *
 * Changes applied to the `captures` table (entité pilote) :
 * 1. Retirer le DEFAULT uuid auto-généré sur id (UUID fourni par le domaine — ADR-026 R1)
 * 2. Corriger createdAt et updatedAt vers TIMESTAMPTZ (ADR-026 R5)
 * 3. Ajouter deletedAt TIMESTAMPTZ NULL (soft delete — ADR-026 R4)
 *
 * Note: Ne pas modifier les migrations existantes.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBaseEntityColumnsToCapturesTable1771300000000 implements MigrationInterface {
  name = 'AddBaseEntityColumnsToCapturesTable1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Retirer le DEFAULT auto-généré de l'id
    //    L'UUID est maintenant fourni par la couche domaine (ADR-026 R1)
    await queryRunner.query(`
      ALTER TABLE captures ALTER COLUMN id DROP DEFAULT
    `);

    // 2. Corriger createdAt vers TIMESTAMPTZ (ADR-026 R5)
    await queryRunner.query(`
      ALTER TABLE captures
        ALTER COLUMN "createdAt" TYPE timestamptz
        USING "createdAt" AT TIME ZONE 'UTC'
    `);

    // 3. Corriger updatedAt vers TIMESTAMPTZ (ADR-026 R5)
    await queryRunner.query(`
      ALTER TABLE captures
        ALTER COLUMN "updatedAt" TYPE timestamptz
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);

    // 4. Ajouter deletedAt pour le soft delete (ADR-026 R4)
    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "deletedAt" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Retirer deletedAt
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "deletedAt"
    `);

    // Remettre updatedAt en timestamp
    await queryRunner.query(`
      ALTER TABLE captures
        ALTER COLUMN "updatedAt" TYPE timestamp
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);

    // Remettre createdAt en timestamp
    await queryRunner.query(`
      ALTER TABLE captures
        ALTER COLUMN "createdAt" TYPE timestamp
        USING "createdAt" AT TIME ZONE 'UTC'
    `);

    // Remettre le DEFAULT gen_random_uuid() sur id
    // Note: gen_random_uuid() est natif PostgreSQL 13+ (pas de dépendance uuid-ossp)
    await queryRunner.query(`
      ALTER TABLE captures ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `);
  }
}
