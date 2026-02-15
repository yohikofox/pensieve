import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Missing Sync Columns
 * Story 6.2 - Bug Fix
 *
 * Adds missing sync columns to thoughts, ideas, todos tables:
 * - last_modified_at: BIGINT timestamp in milliseconds
 * - _status: TEXT ('active' | 'deleted') for soft delete
 *
 * Adds indexes and triggers for auto-update last_modified_at
 *
 * Safe to run multiple times (checks if columns exist before adding)
 */
export class FixMissingSyncColumns1771172263494 implements MigrationInterface {
  name = 'FixMissingSyncColumns1771172263494';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if column exists
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column],
      );
      return result.length > 0;
    };

    // ========================================
    // Add sync columns to thoughts table
    // ========================================
    if (!(await columnExists('thoughts', 'last_modified_at'))) {
      await queryRunner.query(
        `ALTER TABLE "thoughts" ADD COLUMN "last_modified_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "thoughts"."last_modified_at" IS 'Last modification timestamp in milliseconds (sync protocol)'`,
      );
    }

    if (!(await columnExists('thoughts', '_status'))) {
      await queryRunner.query(
        `ALTER TABLE "thoughts" ADD COLUMN "_status" TEXT NOT NULL DEFAULT 'active'`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "thoughts"."_status" IS 'Record status: active | deleted (soft delete for sync)'`,
      );
    }

    // Create index if it doesn't exist
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_THOUGHTS_LAST_MODIFIED" ON "thoughts" ("last_modified_at")`,
    );

    // ========================================
    // Add sync columns to ideas table
    // ========================================
    if (!(await columnExists('ideas', 'last_modified_at'))) {
      await queryRunner.query(
        `ALTER TABLE "ideas" ADD COLUMN "last_modified_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "ideas"."last_modified_at" IS 'Last modification timestamp in milliseconds (sync protocol)'`,
      );
    }

    if (!(await columnExists('ideas', '_status'))) {
      await queryRunner.query(`ALTER TABLE "ideas" ADD COLUMN "_status" TEXT NOT NULL DEFAULT 'active'`);
      await queryRunner.query(
        `COMMENT ON COLUMN "ideas"."_status" IS 'Record status: active | deleted (soft delete for sync)'`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IDEAS_LAST_MODIFIED" ON "ideas" ("last_modified_at")`,
    );

    // ========================================
    // Add sync columns to todos table
    // ========================================
    if (!(await columnExists('todos', 'last_modified_at'))) {
      await queryRunner.query(
        `ALTER TABLE "todos" ADD COLUMN "last_modified_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "todos"."last_modified_at" IS 'Last modification timestamp in milliseconds (sync protocol)'`,
      );
    }

    if (!(await columnExists('todos', '_status'))) {
      await queryRunner.query(`ALTER TABLE "todos" ADD COLUMN "_status" TEXT NOT NULL DEFAULT 'active'`);
      await queryRunner.query(
        `COMMENT ON COLUMN "todos"."_status" IS 'Record status: active | deleted (soft delete for sync)'`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_TODOS_LAST_MODIFIED" ON "todos" ("last_modified_at")`,
    );

    // ========================================
    // Create trigger function for auto-update last_modified_at
    // ========================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_last_modified()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_modified_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Add triggers to all tables (IF NOT EXISTS not supported for triggers, use exception handling)
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TRIGGER thoughts_update_last_modified
        BEFORE UPDATE ON thoughts
        FOR EACH ROW
        EXECUTE FUNCTION update_last_modified();
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TRIGGER ideas_update_last_modified
        BEFORE UPDATE ON ideas
        FOR EACH ROW
        EXECUTE FUNCTION update_last_modified();
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TRIGGER todos_update_last_modified
        BEFORE UPDATE ON todos
        FOR EACH ROW
        EXECUTE FUNCTION update_last_modified();
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS thoughts_update_last_modified ON thoughts`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS ideas_update_last_modified ON ideas`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS todos_update_last_modified ON todos`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_last_modified()`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_THOUGHTS_LAST_MODIFIED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_IDEAS_LAST_MODIFIED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TODOS_LAST_MODIFIED"`);

    // Drop columns
    await queryRunner.query(`ALTER TABLE "thoughts" DROP COLUMN IF EXISTS "last_modified_at"`);
    await queryRunner.query(`ALTER TABLE "thoughts" DROP COLUMN IF EXISTS "_status"`);
    await queryRunner.query(`ALTER TABLE "ideas" DROP COLUMN IF EXISTS "last_modified_at"`);
    await queryRunner.query(`ALTER TABLE "ideas" DROP COLUMN IF EXISTS "_status"`);
    await queryRunner.query(`ALTER TABLE "todos" DROP COLUMN IF EXISTS "last_modified_at"`);
    await queryRunner.query(`ALTER TABLE "todos" DROP COLUMN IF EXISTS "_status"`);
  }
}
