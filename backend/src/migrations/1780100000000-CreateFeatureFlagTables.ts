/**
 * Migration: Création des tables du système de feature flags
 * Story 24.1: Feature Flag System — Backend Data Model & Resolution Engine (AC1)
 *
 * Crée les 4 tables :
 *   - features           : référentiel des feature flags
 *   - user_feature_assignments    : assignations par utilisateur
 *   - role_feature_assignments    : assignations par rôle
 *   - permission_feature_assignments : assignations par permission
 *
 * Toutes les tables incluent des contraintes UNIQUE et des indexes pour les
 * performances (AC6 — pas de N+1).
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureFlagTables1780100000000 implements MigrationInterface {
  name = 'CreateFeatureFlagTables1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "features" (
        "id"            UUID PRIMARY KEY,
        "key"           VARCHAR(100) NOT NULL UNIQUE,
        "description"   TEXT,
        "default_value" BOOLEAN NOT NULL DEFAULT false,
        "created_at"    TIMESTAMPTZ DEFAULT now(),
        "updated_at"    TIMESTAMPTZ DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_FEATURES_DELETED_AT" ON "features" ("deleted_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_feature_assignments" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "feature_id" UUID NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
        "value"      BOOLEAN NOT NULL,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        UNIQUE ("user_id", "feature_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_USER_FEATURE_ASSIGNMENTS_USER_ID"
        ON "user_feature_assignments" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "role_feature_assignments" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id"    UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "feature_id" UUID NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
        "value"      BOOLEAN NOT NULL,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        UNIQUE ("role_id", "feature_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ROLE_FEATURE_ASSIGNMENTS_ROLE_ID"
        ON "role_feature_assignments" ("role_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "permission_feature_assignments" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "feature_id"    UUID NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
        "value"         BOOLEAN NOT NULL,
        "created_at"    TIMESTAMPTZ DEFAULT now(),
        UNIQUE ("permission_id", "feature_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_PERMISSION_FEATURE_ASSIGNMENTS_PERMISSION_ID"
        ON "permission_feature_assignments" ("permission_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "permission_feature_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_feature_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_feature_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "features"`);
  }
}
