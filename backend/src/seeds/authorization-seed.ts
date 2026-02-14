import { DataSource } from 'typeorm';
import { ResourceType } from '../modules/authorization/core/enums/resource-type.enum';
import { PermissionAction } from '../modules/authorization/core/enums/permission-action.enum';
import { ShareRole } from '../modules/authorization/core/enums/share-role.enum';

/**
 * Seed script for authorization system
 *
 * Creates:
 * - Default roles (admin, user, guest)
 * - Default permissions for all resource types
 * - Subscription tiers (free, pro, enterprise)
 * - Share roles (viewer, contributor, admin)
 * - Permission mappings
 *
 * Usage: npm run seed:authorization
 */
export async function seedAuthorization(dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding authorization data...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ========================================
    // 1. Create Permissions
    // ========================================
    console.log('📋 Creating permissions...');

    const permissions = [
      // Thought permissions
      {
        name: 'thought.read',
        displayName: 'Read thoughts',
        resourceType: ResourceType.THOUGHT,
        action: PermissionAction.READ,
        isPaidFeature: false,
      },
      {
        name: 'thought.create',
        displayName: 'Create thoughts',
        resourceType: ResourceType.THOUGHT,
        action: PermissionAction.CREATE,
        isPaidFeature: false,
      },
      {
        name: 'thought.update',
        displayName: 'Update thoughts',
        resourceType: ResourceType.THOUGHT,
        action: PermissionAction.UPDATE,
        isPaidFeature: false,
      },
      {
        name: 'thought.delete',
        displayName: 'Delete thoughts',
        resourceType: ResourceType.THOUGHT,
        action: PermissionAction.DELETE,
        isPaidFeature: false,
      },
      {
        name: 'thought.share',
        displayName: 'Share thoughts with others',
        resourceType: ResourceType.THOUGHT,
        action: PermissionAction.SHARE,
        isPaidFeature: true, // Paid feature
      },

      // Idea permissions
      {
        name: 'idea.read',
        displayName: 'Read ideas',
        resourceType: ResourceType.IDEA,
        action: PermissionAction.READ,
        isPaidFeature: false,
      },
      {
        name: 'idea.create',
        displayName: 'Create ideas',
        resourceType: ResourceType.IDEA,
        action: PermissionAction.CREATE,
        isPaidFeature: false,
      },
      {
        name: 'idea.update',
        displayName: 'Update ideas',
        resourceType: ResourceType.IDEA,
        action: PermissionAction.UPDATE,
        isPaidFeature: false,
      },
      {
        name: 'idea.delete',
        displayName: 'Delete ideas',
        resourceType: ResourceType.IDEA,
        action: PermissionAction.DELETE,
        isPaidFeature: false,
      },

      // Todo permissions
      {
        name: 'todo.read',
        displayName: 'Read todos',
        resourceType: ResourceType.TODO,
        action: PermissionAction.READ,
        isPaidFeature: false,
      },
      {
        name: 'todo.create',
        displayName: 'Create todos',
        resourceType: ResourceType.TODO,
        action: PermissionAction.CREATE,
        isPaidFeature: false,
      },
      {
        name: 'todo.update',
        displayName: 'Update todos',
        resourceType: ResourceType.TODO,
        action: PermissionAction.UPDATE,
        isPaidFeature: false,
      },
      {
        name: 'todo.delete',
        displayName: 'Delete todos',
        resourceType: ResourceType.TODO,
        action: PermissionAction.DELETE,
        isPaidFeature: false,
      },

      // Admin permissions
      {
        name: 'admin.access',
        displayName: 'Access admin panel',
        resourceType: 'system',
        action: PermissionAction.READ,
        isPaidFeature: false,
      },
      {
        name: 'admin.sync.view',
        displayName: 'View sync metrics and logs',
        resourceType: 'system',
        action: PermissionAction.READ,
        isPaidFeature: false,
      },
    ];

    const permissionIds: Record<string, string> = {};

    for (const perm of permissions) {
      // Check if permission already exists
      const existing = await queryRunner.query(
        'SELECT id FROM permissions WHERE name = $1',
        [perm.name],
      );

      if (existing.length > 0) {
        permissionIds[perm.name] = existing[0].id;
        console.log(`  ✓ Permission "${perm.name}" already exists`);
      } else {
        const result = await queryRunner.query(
          `INSERT INTO permissions (name, display_name, resource_type, action, is_paid_feature)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            perm.name,
            perm.displayName,
            perm.resourceType,
            perm.action,
            perm.isPaidFeature,
          ],
        );
        permissionIds[perm.name] = result[0].id;
        console.log(`  ✓ Created permission "${perm.name}"`);
      }
    }

    // ========================================
    // 2. Create Roles
    // ========================================
    console.log('👥 Creating roles...');

    const roles = [
      { name: 'admin', displayName: 'Administrator', isSystem: true },
      { name: 'user', displayName: 'Standard User', isSystem: true },
      { name: 'guest', displayName: 'Guest User', isSystem: true },
    ];

    const roleIds: Record<string, string> = {};

    for (const role of roles) {
      const existing = await queryRunner.query(
        'SELECT id FROM roles WHERE name = $1',
        [role.name],
      );

      if (existing.length > 0) {
        roleIds[role.name] = existing[0].id;
        console.log(`  ✓ Role "${role.name}" already exists`);
      } else {
        const result = await queryRunner.query(
          `INSERT INTO roles (name, display_name, is_system)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [role.name, role.displayName, role.isSystem],
        );
        roleIds[role.name] = result[0].id;
        console.log(`  ✓ Created role "${role.name}"`);
      }
    }

    // ========================================
    // 3. Assign permissions to roles
    // ========================================
    console.log('🔗 Assigning permissions to roles...');

    // Admin: all permissions
    const adminPermissions = Object.values(permissionIds);

    // User: all permissions except thought.share
    const userPermissions = Object.entries(permissionIds)
      .filter(([name]) => name !== 'thought.share')
      .map(([, id]) => id);

    // Guest: only read permissions
    const guestPermissions = Object.entries(permissionIds)
      .filter(([name]) => name.endsWith('.read'))
      .map(([, id]) => id);

    const rolePermissionMappings = [
      { roleId: roleIds.admin, permissionIds: adminPermissions },
      { roleId: roleIds.user, permissionIds: userPermissions },
      { roleId: roleIds.guest, permissionIds: guestPermissions },
    ];

    for (const mapping of rolePermissionMappings) {
      for (const permissionId of mapping.permissionIds) {
        const existing = await queryRunner.query(
          'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
          [mapping.roleId, permissionId],
        );

        if (existing.length === 0) {
          await queryRunner.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [mapping.roleId, permissionId],
          );
        }
      }
    }

    console.log('  ✓ Role-permission mappings created');

    // ========================================
    // 4. Create Subscription Tiers
    // ========================================
    console.log('💳 Creating subscription tiers...');

    const tiers = [
      { name: 'free', priceMonthly: 0, isActive: true },
      { name: 'pro', priceMonthly: 9.99, isActive: true },
      { name: 'enterprise', priceMonthly: 29.99, isActive: true },
    ];

    const tierIds: Record<string, string> = {};

    for (const tier of tiers) {
      const existing = await queryRunner.query(
        'SELECT id FROM subscription_tiers WHERE name = $1',
        [tier.name],
      );

      if (existing.length > 0) {
        tierIds[tier.name] = existing[0].id;
        console.log(`  ✓ Tier "${tier.name}" already exists`);
      } else {
        const result = await queryRunner.query(
          `INSERT INTO subscription_tiers (name, price_monthly, is_active)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [tier.name, tier.priceMonthly, tier.isActive],
        );
        tierIds[tier.name] = result[0].id;
        console.log(
          `  ✓ Created tier "${tier.name}" (€${tier.priceMonthly}/month)`,
        );
      }
    }

    // ========================================
    // 5. Assign permissions to tiers
    // ========================================
    console.log('🔗 Assigning permissions to tiers...');

    // Free: all basic permissions (no thought.share)
    const freePermissions = Object.entries(permissionIds)
      .filter(([name]) => name !== 'thought.share')
      .map(([, id]) => id);

    // Pro: free + thought.share
    const proPermissions = Object.values(permissionIds);

    // Enterprise: all permissions
    const enterprisePermissions = Object.values(permissionIds);

    const tierPermissionMappings = [
      { tierId: tierIds.free, permissionIds: freePermissions },
      { tierId: tierIds.pro, permissionIds: proPermissions },
      { tierId: tierIds.enterprise, permissionIds: enterprisePermissions },
    ];

    for (const mapping of tierPermissionMappings) {
      for (const permissionId of mapping.permissionIds) {
        const existing = await queryRunner.query(
          'SELECT 1 FROM tier_permissions WHERE tier_id = $1 AND permission_id = $2',
          [mapping.tierId, permissionId],
        );

        if (existing.length === 0) {
          await queryRunner.query(
            'INSERT INTO tier_permissions (tier_id, permission_id) VALUES ($1, $2)',
            [mapping.tierId, permissionId],
          );
        }
      }
    }

    console.log('  ✓ Tier-permission mappings created');

    // ========================================
    // 6. Create Share Roles
    // ========================================
    console.log('🔓 Creating share roles...');

    const shareRoles = [
      // Thought share roles
      { name: ShareRole.VIEWER, resourceType: ResourceType.THOUGHT },
      { name: ShareRole.CONTRIBUTOR, resourceType: ResourceType.THOUGHT },
      { name: ShareRole.ADMIN, resourceType: ResourceType.THOUGHT },

      // Idea share roles
      { name: ShareRole.VIEWER, resourceType: ResourceType.IDEA },
      { name: ShareRole.CONTRIBUTOR, resourceType: ResourceType.IDEA },
      { name: ShareRole.ADMIN, resourceType: ResourceType.IDEA },

      // Todo share roles
      { name: ShareRole.VIEWER, resourceType: ResourceType.TODO },
      { name: ShareRole.CONTRIBUTOR, resourceType: ResourceType.TODO },
      { name: ShareRole.ADMIN, resourceType: ResourceType.TODO },
    ];

    const shareRoleIds: Record<string, string> = {};

    for (const shareRole of shareRoles) {
      const key = `${shareRole.name}:${shareRole.resourceType}`;
      const existing = await queryRunner.query(
        'SELECT id FROM share_roles WHERE name = $1 AND resource_type = $2',
        [shareRole.name, shareRole.resourceType],
      );

      if (existing.length > 0) {
        shareRoleIds[key] = existing[0].id;
        console.log(`  ✓ Share role "${key}" already exists`);
      } else {
        const result = await queryRunner.query(
          `INSERT INTO share_roles (name, resource_type)
           VALUES ($1, $2)
           RETURNING id`,
          [shareRole.name, shareRole.resourceType],
        );
        shareRoleIds[key] = result[0].id;
        console.log(`  ✓ Created share role "${key}"`);
      }
    }

    // ========================================
    // 7. Assign permissions to share roles
    // ========================================
    console.log('🔗 Assigning permissions to share roles...');

    const shareRolePermissionMappings = [
      // Thought viewer: read only
      {
        shareRoleKey: `${ShareRole.VIEWER}:${ResourceType.THOUGHT}`,
        permissionNames: ['thought.read'],
      },
      // Thought contributor: read + update
      {
        shareRoleKey: `${ShareRole.CONTRIBUTOR}:${ResourceType.THOUGHT}`,
        permissionNames: ['thought.read', 'thought.update'],
      },
      // Thought admin: all thought permissions
      {
        shareRoleKey: `${ShareRole.ADMIN}:${ResourceType.THOUGHT}`,
        permissionNames: [
          'thought.read',
          'thought.update',
          'thought.delete',
          'thought.share',
        ],
      },

      // Idea viewer
      {
        shareRoleKey: `${ShareRole.VIEWER}:${ResourceType.IDEA}`,
        permissionNames: ['idea.read'],
      },
      // Idea contributor
      {
        shareRoleKey: `${ShareRole.CONTRIBUTOR}:${ResourceType.IDEA}`,
        permissionNames: ['idea.read', 'idea.update'],
      },
      // Idea admin
      {
        shareRoleKey: `${ShareRole.ADMIN}:${ResourceType.IDEA}`,
        permissionNames: ['idea.read', 'idea.update', 'idea.delete'],
      },

      // Todo viewer
      {
        shareRoleKey: `${ShareRole.VIEWER}:${ResourceType.TODO}`,
        permissionNames: ['todo.read'],
      },
      // Todo contributor
      {
        shareRoleKey: `${ShareRole.CONTRIBUTOR}:${ResourceType.TODO}`,
        permissionNames: ['todo.read', 'todo.update'],
      },
      // Todo admin
      {
        shareRoleKey: `${ShareRole.ADMIN}:${ResourceType.TODO}`,
        permissionNames: ['todo.read', 'todo.update', 'todo.delete'],
      },
    ];

    for (const mapping of shareRolePermissionMappings) {
      const shareRoleId = shareRoleIds[mapping.shareRoleKey];

      for (const permName of mapping.permissionNames) {
        const permissionId = permissionIds[permName];

        const existing = await queryRunner.query(
          'SELECT 1 FROM share_role_permissions WHERE share_role_id = $1 AND permission_id = $2',
          [shareRoleId, permissionId],
        );

        if (existing.length === 0) {
          await queryRunner.query(
            'INSERT INTO share_role_permissions (share_role_id, permission_id) VALUES ($1, $2)',
            [shareRoleId, permissionId],
          );
        }
      }
    }

    console.log('  ✓ Share role-permission mappings created');

    await queryRunner.commitTransaction();
    console.log('✅ Authorization seed completed successfully!');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error seeding authorization data:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
