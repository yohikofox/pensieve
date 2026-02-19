import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 14.4 — Review Fix: Rename capture indexes to match entity declarations
 *
 * After migration 1771900000000-RenameUserIdToOwnerId, the DB columns were
 * renamed (userId → owner_id) but the index names were NOT updated.
 * The Capture entity now declares IDX_CAPTURES_OWNER_ID and IDX_CAPTURES_CLIENT_OWNER,
 * but the DB still has IDX_CAPTURES_USER_ID and IDX_CAPTURES_CLIENT_USER.
 *
 * Affected: captures table only (Thought/Idea/Todo/Notification had no named indexes
 * referencing userId, only anonymous inline @Index decorators).
 */
export class RenameOwnerIndexes1771900000002 implements MigrationInterface {
  name = 'RenameOwnerIndexes1771900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename single-column owner index
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_CAPTURES_USER_ID" RENAME TO "IDX_CAPTURES_OWNER_ID"`,
    );

    // Rename composite unique index (clientId + ownerId)
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_CAPTURES_CLIENT_USER" RENAME TO "IDX_CAPTURES_CLIENT_OWNER"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_CAPTURES_CLIENT_OWNER" RENAME TO "IDX_CAPTURES_CLIENT_USER"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_CAPTURES_OWNER_ID" RENAME TO "IDX_CAPTURES_USER_ID"`,
    );
  }
}
