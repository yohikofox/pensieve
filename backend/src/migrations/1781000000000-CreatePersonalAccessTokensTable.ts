/**
 * Migration: Création de la table personal_access_tokens
 * Story 27.1: PAT Backend — Table + PATService + PATGuard + Endpoints CRUD + Renew
 *
 * Crée :
 *   - personal_access_tokens : Tokens d'accès personnel pour clients non-interactifs (MCP, scripts)
 *
 * Design :
 * - token_hash : SHA-256 du token brut (jamais le token en clair)
 * - prefix     : 12 premiers caractères du token (pns_ + 8 chars) pour affichage
 * - scopes     : tableau text[] pour permissions granulaires
 * - revoked_at : soft-revocation (pas de DELETE)
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonalAccessTokensTable1781000000000
  implements MigrationInterface
{
  name = 'CreatePersonalAccessTokensTable1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "personal_access_tokens" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"         VARCHAR(100) NOT NULL,
        "token_hash"   VARCHAR(64) NOT NULL UNIQUE,
        "prefix"       VARCHAR(12) NOT NULL,
        "scopes"       TEXT[] NOT NULL DEFAULT '{}',
        "expires_at"   TIMESTAMPTZ NOT NULL,
        "last_used_at" TIMESTAMPTZ,
        "revoked_at"   TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_PAT_USER_ID"
        ON "personal_access_tokens" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_PAT_TOKEN_HASH"
        ON "personal_access_tokens" ("token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAT_TOKEN_HASH"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAT_USER_ID"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "personal_access_tokens"`,
    );
  }
}
