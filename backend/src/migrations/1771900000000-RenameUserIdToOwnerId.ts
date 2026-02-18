import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 14.4 — ADR-026 R7: Rename userId → owner_id
 *
 * Decision recorded: 2026-02-18 by yohikofox.
 * Renames the userId column to owner_id on all 5 main entity tables
 * to conform to ADR-026 R7 naming convention.
 *
 * Affected tables: captures, thoughts, ideas, todos, notifications
 */
export class RenameUserIdToOwnerId1771900000000 implements MigrationInterface {
  name = 'RenameUserIdToOwnerId1771900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "userId" TO "owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "userId" TO "owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "userId" TO "owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "userId" TO "owner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "userId" TO "owner_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "owner_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "owner_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "owner_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "owner_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "owner_id" TO "userId"`,
    );
  }
}
