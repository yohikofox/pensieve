import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePATAuditLogsTable1781100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pat_audit_logs" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_id"   UUID NOT NULL,
        "user_id"    UUID NOT NULL,
        "pat_id"     UUID NOT NULL,
        "action"     VARCHAR(20) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_PAT_AUDIT_ADMIN_ID" ON "pat_audit_logs" ("admin_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PAT_AUDIT_USER_ID" ON "pat_audit_logs" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PAT_AUDIT_PAT_ID" ON "pat_audit_logs" ("pat_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAT_AUDIT_PAT_ID";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAT_AUDIT_USER_ID";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAT_AUDIT_ADMIN_ID";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pat_audit_logs";`);
  }
}
