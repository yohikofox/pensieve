import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 14.4 — Review Fix: Align Notification entity with ADR-026 R4 (soft delete)
 *
 * Changes:
 * 1. Drop auto-generated DEFAULT on notifications.id — UUID is now domain-generated
 *    (AppBaseEntity uses @PrimaryColumn, not @PrimaryGeneratedColumn)
 * 2. Add "deletedAt" column (TIMESTAMPTZ, nullable) for soft delete support
 */
export class AddNotificationSoftDelete1771900000001
  implements MigrationInterface
{
  name = 'AddNotificationSoftDelete1771900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove DB-generated UUID default — domain layer now generates UUIDs
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT`,
    );

    // 2. Add soft-delete column (ADR-026 R4)
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL`,
    );

    // 3. Add index on deletedAt (consistent with AppBaseEntity @Index() decorator)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATIONS_DELETED_AT" ON "notifications" ("deletedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_NOTIFICATIONS_DELETED_AT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN IF EXISTS "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`,
    );
  }
}
