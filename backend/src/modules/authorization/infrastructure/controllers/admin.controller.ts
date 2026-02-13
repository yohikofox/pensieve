import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { PermissionRepository } from '../../implementations/postgresql/repositories/permission.repository';
import { RoleRepository } from '../../implementations/postgresql/repositories/role.repository';
import { UserRoleRepository } from '../../implementations/postgresql/repositories/user-role.repository';
import { UserPermissionRepository } from '../../implementations/postgresql/repositories/user-permission.repository';
import { SubscriptionTierRepository } from '../../implementations/postgresql/repositories/subscription-tier.repository';
import { UserSubscriptionRepository } from '../../implementations/postgresql/repositories/user-subscription.repository';
import { RolePermissionRepository } from '../../implementations/postgresql/repositories/role-permission.repository';
import { TierPermissionRepository } from '../../implementations/postgresql/repositories/tier-permission.repository';
import { DataSource } from 'typeorm';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { Role } from '../../implementations/postgresql/entities/role.entity';
import { UserRole } from '../../implementations/postgresql/entities/user-role.entity';
import { Permission } from '../../implementations/postgresql/entities/permission.entity';
import { UserPermission } from '../../implementations/postgresql/entities/user-permission.entity';
import { SubscriptionTier } from '../../implementations/postgresql/entities/subscription-tier.entity';
import { PaginationQueryDto, AssignRoleDto } from '../../core/dtos/admin.dto';

@Controller('api/admin')
@UseGuards(AdminJwtGuard)
export class AdminController {
  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly userPermissionRepo: UserPermissionRepository,
    private readonly tierRepo: SubscriptionTierRepository,
    private readonly userSubscriptionRepo: UserSubscriptionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly tierPermissionRepo: TierPermissionRepository,
    private readonly dataSource: DataSource,
  ) {}

  @Get('users')
  async getUsers(@Query() query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.status',
        'user.created_at',
        'user.updated_at',
      ])
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      queryBuilder.where('user.email ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('users/:id')
  async getUserDetails(@Param('id', ParseUUIDPipe) userId: string) {
    const user: User | null = await this.dataSource
      .getRepository(User)
      .findOne({
        where: { id: userId },
        select: ['id', 'email', 'status', 'created_at', 'updated_at'],
      });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRoles = await this.userRoleRepo.findByUserId(userId);

    const roles = await Promise.all(
      userRoles.map(async (ur: UserRole) => {
        const role = await this.roleRepo.findById(ur.roleId);
        if (!role) {
          throw new NotFoundException(`Role ${ur.roleId} not found`);
        }
        return {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          expiresAt: ur.expiresAt,
        };
      }),
    );

    const userPermissions = await this.userPermissionRepo.findByUserId(userId);
    const permissions = await Promise.all(
      userPermissions.map(async (up: UserPermission) => {
        const permission = await this.permissionRepo.findById(up.permissionId);
        if (!permission) {
          throw new NotFoundException(
            `Permission ${up.permissionId} not found`,
          );
        }
        return {
          id: permission.id,
          name: permission.name,
          displayName: permission.displayName,
          granted: up.granted,
          expiresAt: up.expiresAt,
        };
      }),
    );

    const subscription =
      await this.userSubscriptionRepo.findActiveByUserId(userId);
    let subscriptionData: {
      id: string;
      tier: string;
      status: string;
      expiresAt: Date | null;
    } | null = null;
    if (subscription) {
      const tier = await this.tierRepo.findById(subscription.tierId);
      if (!tier) {
        throw new NotFoundException(`Tier ${subscription.tierId} not found`);
      }
      subscriptionData = {
        id: subscription.id,
        tier: tier.name,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
      };
    }

    return { user, roles, permissions, subscription: subscriptionData };
  }

  @Post('users/:id/roles')
  async assignRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    const existing = await this.userRoleRepo.findByUserAndRole(
      userId,
      dto.roleId,
    );
    if (existing) {
      throw new ConflictException('Role already assigned to user');
    }

    const userRole: UserRole = this.userRoleRepo.create({
      userId,
      roleId: dto.roleId,
      expiresAt: dto.expiresAt,
    });

    await this.userRoleRepo.save(userRole);
    return { message: 'Role assigned successfully' };
  }

  @Delete('users/:id/roles/:roleId')
  async revokeRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const userRole = await this.userRoleRepo.findByUserAndRole(userId, roleId);
    if (!userRole) {
      throw new NotFoundException('User role not found');
    }
    await this.userRoleRepo.remove(userRole);
    return { message: 'Role revoked successfully' };
  }

  @Get('roles')
  async getRoles() {
    const roles = await this.roleRepo.findAll();
    return roles.map((role: Role) => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      isSystem: role.isSystem,
    }));
  }

  @Get('permissions')
  async getPermissions() {
    const permissions = await this.permissionRepo.findAll();
    return permissions.map((p: Permission) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      resourceType: p.resourceType,
      action: p.action,
      isPaidFeature: p.isPaidFeature,
    }));
  }

  @Get('tiers')
  async getTiers() {
    const tiers = await this.tierRepo.findAll();
    return tiers.map((t: SubscriptionTier) => ({
      id: t.id,
      name: t.name,
      priceMonthly: t.priceMonthly,
      isActive: t.isActive,
    }));
  }

  @Get('stats/users')
  async getUserStats() {
    const total = await this.dataSource
      .getRepository(User)
      .count();

    const active = await this.dataSource
      .getRepository(User)
      .count({ where: { status: 'active' } });

    const deleted = await this.dataSource
      .getRepository(User)
      .count({ where: { status: 'deleted' } });

    // Users created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.created_at > :date', { date: thirtyDaysAgo })
      .getCount();

    // Calculate growth rate
    const previousPeriodStart = new Date(thirtyDaysAgo);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

    const previousPeriodUsers = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.created_at BETWEEN :start AND :end', {
        start: previousPeriodStart,
        end: thirtyDaysAgo,
      })
      .getCount();

    const growthRate = previousPeriodUsers > 0
      ? ((recentUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : 0;

    return {
      total,
      active,
      deleted,
      recentUsers,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  @Get('stats/subscriptions')
  async getSubscriptionStats() {
    const tiers = await this.tierRepo.findAll();

    const tierStats = await Promise.all(
      tiers.map(async (tier) => {
        const subscribers = await this.userSubscriptionRepo.count({
          where: { tierId: tier.id, status: 'active' },
        });

        return {
          tierName: tier.name,
          subscribers,
          revenue: subscribers * Number(tier.priceMonthly),
        };
      }),
    );

    const totalRevenue = tierStats.reduce((sum, stat) => sum + stat.revenue, 0);

    return {
      tierStats,
      totalRevenue,
    };
  }

  @Get('stats/content')
  async getContentStats() {
    // Import Thought and Idea entities from knowledge module
    const thoughtsCount = await this.dataSource
      .query('SELECT COUNT(*) as count FROM thoughts');

    const ideasCount = await this.dataSource
      .query('SELECT COUNT(*) as count FROM ideas');

    const todosCount = await this.dataSource
      .query('SELECT COUNT(*) as count FROM todos');

    // Recent counts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentThoughts = await this.dataSource
      .query('SELECT COUNT(*) as count FROM thoughts WHERE "createdAt" > $1', [sevenDaysAgo]);

    const recentIdeas = await this.dataSource
      .query('SELECT COUNT(*) as count FROM ideas WHERE "createdAt" > $1', [sevenDaysAgo]);

    const recentTodos = await this.dataSource
      .query('SELECT COUNT(*) as count FROM todos WHERE "createdAt" > $1', [sevenDaysAgo]);

    return {
      thoughts: {
        total: parseInt(thoughtsCount[0].count),
        recent: parseInt(recentThoughts[0].count),
      },
      ideas: {
        total: parseInt(ideasCount[0].count),
        recent: parseInt(recentIdeas[0].count),
      },
      todos: {
        total: parseInt(todosCount[0].count),
        recent: parseInt(recentTodos[0].count),
      },
    };
  }

  @Get('stats/system')
  async getSystemStats() {
    const dbVersion = await this.dataSource.query('SELECT version()');

    return {
      database: dbVersion[0].version.split(' ')[0] + ' ' + dbVersion[0].version.split(' ')[1],
      timestamp: new Date().toISOString(),
    };
  }
}
