/**
 * Migration: Corriger les types de colonnes date vers TIMESTAMPTZ
 *
 * Story 13.3: Corriger les Types de Colonnes Date vers TIMESTAMPTZ (ADR-026 R5)
 *
 * PostgreSQL convertit implicitement TIMESTAMP → TIMESTAMPTZ sans perte de données
 * (les valeurs existantes sont assumées être en UTC si aucun offset n'est présent).
 *
 * Tables affectées (18 entités — toutes les colonnes TIMESTAMP WITHOUT TIME ZONE) :
 * - todos: deadline, completed_at
 * - notifications: sent_at, delivered_at, created_at, updated_at
 * - users: deletion_requested_at, created_at, updated_at
 * - admin_users: created_at, updated_at
 * - audit_logs: timestamp
 * - sync_logs: started_at, completed_at
 * - sync_conflicts: resolved_at
 * - roles: created_at, updated_at
 * - permissions: created_at, updated_at
 * - subscription_tiers: created_at, updated_at
 * - user_roles: expires_at, created_at, updated_at
 * - user_permissions: expires_at, created_at, updated_at
 * - user_subscriptions: expires_at, created_at, updated_at
 * - resource_shares: expires_at, created_at, updated_at
 * - role_permissions: created_at
 * - tier_permissions: created_at
 * - share_roles: created_at, updated_at
 * - share_role_permissions: created_at
 *
 * @see ADR-026 R5 — Types canoniques TIMESTAMPTZ
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTimestampColumnsToTimestamptz1771800000000
  implements MigrationInterface
{
  name = 'AlterTimestampColumnsToTimestamptz1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // todos
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "todos"
        ALTER COLUMN "deadline" TYPE TIMESTAMPTZ,
        ALTER COLUMN "completedAt" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // notifications
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "sentAt" TYPE TIMESTAMPTZ,
        ALTER COLUMN "deliveredAt" TYPE TIMESTAMPTZ,
        ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // users
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "deletion_requested_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // admin_users
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // audit_logs
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "timestamp" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // sync_logs
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "sync_logs"
        ALTER COLUMN "startedAt" TYPE TIMESTAMPTZ,
        ALTER COLUMN "completedAt" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // sync_conflicts
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "sync_conflicts"
        ALTER COLUMN "resolvedAt" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // roles
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "roles"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // permissions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // subscription_tiers
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // user_roles
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "user_roles"
        ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // user_permissions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "user_permissions"
        ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // user_subscriptions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
        ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // resource_shares
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "resource_shares"
        ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // role_permissions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // tier_permissions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "tier_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // share_roles
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "share_roles"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ,
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ
    `);

    // ============================================================
    // share_role_permissions
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "share_role_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Rollback: TIMESTAMPTZ → TIMESTAMP
    // Note: rollback acceptable car PostgreSQL conserve les valeurs UTC
    // ============================================================
    await queryRunner.query(`
      ALTER TABLE "todos"
        ALTER COLUMN "deadline" TYPE TIMESTAMP,
        ALTER COLUMN "completedAt" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "sentAt" TYPE TIMESTAMP,
        ALTER COLUMN "deliveredAt" TYPE TIMESTAMP,
        ALTER COLUMN "createdAt" TYPE TIMESTAMP,
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "deletion_requested_at" TYPE TIMESTAMP,
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "timestamp" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "sync_logs"
        ALTER COLUMN "startedAt" TYPE TIMESTAMP,
        ALTER COLUMN "completedAt" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "sync_conflicts"
        ALTER COLUMN "resolvedAt" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "roles"
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles"
        ALTER COLUMN "expires_at" TYPE TIMESTAMP,
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_permissions"
        ALTER COLUMN "expires_at" TYPE TIMESTAMP,
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
        ALTER COLUMN "expires_at" TYPE TIMESTAMP,
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "resource_shares"
        ALTER COLUMN "expires_at" TYPE TIMESTAMP,
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "tier_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "share_roles"
        ALTER COLUMN "created_at" TYPE TIMESTAMP,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "share_role_permissions"
        ALTER COLUMN "created_at" TYPE TIMESTAMP
    `);
  }
}
