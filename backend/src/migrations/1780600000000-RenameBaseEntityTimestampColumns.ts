/**
 * Migration: Renommage des colonnes timestamp AppBaseEntity vers snake_case
 *
 * AppBaseEntity déclare name: 'created_at', 'updated_at', 'deleted_at' (snake_case),
 * mais les tables ont été créées avant ce nommage avec des colonnes camelCase.
 *
 * Tables affectées (toutes les entités étendant AppBaseEntity) :
 * - thoughts  : createdAt, updatedAt, deletedAt → created_at, updated_at, deleted_at
 * - ideas     : createdAt, updatedAt, deletedAt → created_at, updated_at, deleted_at
 * - todos     : createdAt, updatedAt, deletedAt → created_at, updated_at, deleted_at
 * - captures  : createdAt, updatedAt, deletedAt → created_at, updated_at, deleted_at
 * - notifications : createdAt, updatedAt, deletedAt → created_at, updated_at, deleted_at
 *
 * Note: PostgreSQL met à jour automatiquement les index existants lors d'un RENAME COLUMN.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBaseEntityTimestampColumns1780600000000 implements MigrationInterface {
  name = 'RenameBaseEntityTimestampColumns1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // thoughts
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "deletedAt" TO "deleted_at"`,
    );

    // ============================================================
    // ideas
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "deletedAt" TO "deleted_at"`,
    );

    // ============================================================
    // todos
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "deletedAt" TO "deleted_at"`,
    );

    // ============================================================
    // captures
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "deletedAt" TO "deleted_at"`,
    );

    // ============================================================
    // notifications
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "deletedAt" TO "deleted_at"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // notifications
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" RENAME COLUMN "deleted_at" TO "deletedAt"`,
    );

    // ============================================================
    // captures
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "captures" RENAME COLUMN "deleted_at" TO "deletedAt"`,
    );

    // ============================================================
    // todos
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todos" RENAME COLUMN "deleted_at" TO "deletedAt"`,
    );

    // ============================================================
    // ideas
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ideas" RENAME COLUMN "deleted_at" TO "deletedAt"`,
    );

    // ============================================================
    // thoughts
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thoughts" RENAME COLUMN "deleted_at" TO "deletedAt"`,
    );
  }
}
