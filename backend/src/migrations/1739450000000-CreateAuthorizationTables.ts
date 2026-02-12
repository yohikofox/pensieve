import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Migration: Create Authorization System Tables
 *
 * Creates all tables for the multi-level authorization system:
 * - RBAC (Role-Based Access Control)
 * - PBAC (Permission-Based Access Control)
 * - ACL (Access Control Lists for resource sharing)
 * - Subscription tiers
 *
 * Architecture:
 * - permissions: Available permissions in the system
 * - roles: System and custom roles
 * - role_permissions: Permissions assigned to roles
 * - user_roles: Roles assigned to users
 * - user_permissions: Direct user permission overrides
 * - subscription_tiers: Available subscription plans
 * - tier_permissions: Permissions included in each tier
 * - user_subscriptions: User subscription status
 * - share_roles: Roles for shared resources (viewer, contributor, admin)
 * - share_role_permissions: Permissions for each share role
 * - resource_shares: Shared resources with access control
 */
export class CreateAuthorizationTables1739450000000 implements MigrationInterface {
  name = 'CreateAuthorizationTables1739450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Create 'permissions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
            comment: 'Permission name (e.g., "thought.read")',
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '200',
            comment: 'Human-readable permission name',
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '50',
            comment: 'Type of resource (thought, idea, todo)',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
            comment: 'Action (read, create, update, delete, share)',
          },
          {
            name: 'is_paid_feature',
            type: 'boolean',
            default: false,
            comment: 'Whether this permission requires a paid subscription',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on name for fast permission resolution
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_PERMISSIONS_NAME',
        columnNames: ['name'],
      }),
    );

    // ========================================
    // 2. Create 'roles' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
            comment: 'Role name (e.g., "admin", "user")',
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '200',
            comment: 'Human-readable role name',
          },
          {
            name: 'is_system',
            type: 'boolean',
            default: false,
            comment: 'System roles cannot be deleted',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // ========================================
    // 3. Create 'role_permissions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'role_permissions',
        columns: [
          {
            name: 'role_id',
            type: 'uuid',
          },
          {
            name: 'permission_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Composite primary key
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "PK_ROLE_PERMISSIONS" PRIMARY KEY ("role_id", "permission_id")`,
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        columnNames: ['permission_id'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ========================================
    // 4. Create 'user_roles' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            comment: 'Reference to user (from Supabase)',
          },
          {
            name: 'role_id',
            type: 'uuid',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Optional expiration date for temporary roles',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on user_id for fast user permission lookup
    await queryRunner.createIndex(
      'user_roles',
      new TableIndex({
        name: 'IDX_USER_ROLES_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    // Foreign key to roles
    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ========================================
    // 5. Create 'user_permissions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'user_permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            comment: 'Reference to user (from Supabase)',
          },
          {
            name: 'permission_id',
            type: 'uuid',
          },
          {
            name: 'granted',
            type: 'boolean',
            comment: 'true = grant override, false = deny override',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Optional expiration date for temporary permissions',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on user_id for fast override lookup
    await queryRunner.createIndex(
      'user_permissions',
      new TableIndex({
        name: 'IDX_USER_PERMISSIONS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    // Foreign key to permissions
    await queryRunner.createForeignKey(
      'user_permissions',
      new TableForeignKey({
        columnNames: ['permission_id'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ========================================
    // 6. Create 'subscription_tiers' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'subscription_tiers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
            isUnique: true,
            comment: 'Tier name (e.g., "free", "pro", "enterprise")',
          },
          {
            name: 'price_monthly',
            type: 'decimal',
            precision: 10,
            scale: 2,
            comment: 'Monthly price in euros',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            comment: 'Whether this tier is available for subscription',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // ========================================
    // 7. Create 'tier_permissions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'tier_permissions',
        columns: [
          {
            name: 'tier_id',
            type: 'uuid',
          },
          {
            name: 'permission_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Composite primary key
    await queryRunner.query(
      `ALTER TABLE "tier_permissions" ADD CONSTRAINT "PK_TIER_PERMISSIONS" PRIMARY KEY ("tier_id", "permission_id")`,
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'tier_permissions',
      new TableForeignKey({
        columnNames: ['tier_id'],
        referencedTableName: 'subscription_tiers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'tier_permissions',
      new TableForeignKey({
        columnNames: ['permission_id'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ========================================
    // 8. Create 'user_subscriptions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'user_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            comment: 'Reference to user (from Supabase)',
          },
          {
            name: 'tier_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
            comment:
              'Subscription status (active, expired, cancelled, pending)',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Expiration date (null = unlimited)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on user_id for fast subscription lookup
    await queryRunner.createIndex(
      'user_subscriptions',
      new TableIndex({
        name: 'IDX_USER_SUBSCRIPTIONS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    // Foreign key to subscription_tiers
    await queryRunner.createForeignKey(
      'user_subscriptions',
      new TableForeignKey({
        columnNames: ['tier_id'],
        referencedTableName: 'subscription_tiers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // ========================================
    // 9. Create 'share_roles' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'share_roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
            comment: 'Share role name (e.g., "viewer", "contributor", "admin")',
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '50',
            comment: 'Type of resource this role applies to',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Unique constraint on (name, resource_type)
    await queryRunner.createIndex(
      'share_roles',
      new TableIndex({
        name: 'IDX_SHARE_ROLES_NAME_RESOURCE',
        columnNames: ['name', 'resource_type'],
        isUnique: true,
      }),
    );

    // ========================================
    // 10. Create 'share_role_permissions' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'share_role_permissions',
        columns: [
          {
            name: 'share_role_id',
            type: 'uuid',
          },
          {
            name: 'permission_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Composite primary key
    await queryRunner.query(
      `ALTER TABLE "share_role_permissions" ADD CONSTRAINT "PK_SHARE_ROLE_PERMISSIONS" PRIMARY KEY ("share_role_id", "permission_id")`,
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'share_role_permissions',
      new TableForeignKey({
        columnNames: ['share_role_id'],
        referencedTableName: 'share_roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'share_role_permissions',
      new TableForeignKey({
        columnNames: ['permission_id'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ========================================
    // 11. Create 'resource_shares' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'resource_shares',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '50',
            comment: 'Type of resource being shared (thought, idea, todo)',
          },
          {
            name: 'resource_id',
            type: 'uuid',
            comment: 'ID of the shared resource',
          },
          {
            name: 'owner_id',
            type: 'uuid',
            comment: 'ID of the resource owner',
          },
          {
            name: 'shared_with_id',
            type: 'uuid',
            comment: 'ID of the user with whom the resource is shared',
          },
          {
            name: 'share_role_id',
            type: 'uuid',
            comment: 'Share role (viewer, contributor, admin)',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Optional expiration date for the share',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Composite index on (resource_type, resource_id, shared_with_id) for fast ACL lookup
    await queryRunner.createIndex(
      'resource_shares',
      new TableIndex({
        name: 'IDX_RESOURCE_SHARES_LOOKUP',
        columnNames: ['resource_type', 'resource_id', 'shared_with_id'],
      }),
    );

    // Index on owner_id for listing user's shared resources
    await queryRunner.createIndex(
      'resource_shares',
      new TableIndex({
        name: 'IDX_RESOURCE_SHARES_OWNER',
        columnNames: ['owner_id'],
      }),
    );

    // Foreign key to share_roles
    await queryRunner.createForeignKey(
      'resource_shares',
      new TableForeignKey({
        columnNames: ['share_role_id'],
        referencedTableName: 'share_roles',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.dropTable('resource_shares', true);
    await queryRunner.dropTable('share_role_permissions', true);
    await queryRunner.dropTable('share_roles', true);
    await queryRunner.dropTable('user_subscriptions', true);
    await queryRunner.dropTable('tier_permissions', true);
    await queryRunner.dropTable('subscription_tiers', true);
    await queryRunner.dropTable('user_permissions', true);
    await queryRunner.dropTable('user_roles', true);
    await queryRunner.dropTable('role_permissions', true);
    await queryRunner.dropTable('roles', true);
    await queryRunner.dropTable('permissions', true);
  }
}
