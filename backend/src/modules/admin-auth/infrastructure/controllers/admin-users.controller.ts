import {
  Controller,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { UserFeaturesService } from '../../../identity/application/services/user-features.service';
import { SupabaseAdminService } from '../../../rgpd/application/services/supabase-admin.service';
import { RgpdService } from '../../../rgpd/application/services/rgpd.service';
import { UpdateUserFeaturesDto } from '../../application/dtos/update-user-features.dto';
import { ResetUserPasswordDto } from '../../application/dtos/reset-user-password.dto';
import { UserFeaturesDto } from '../../../identity/application/dtos/user-features.dto';

/**
 * Admin controller for managing user features/permissions
 * Story 7.1: Support Mode avec Permissions Backend - Task 2
 * Story 8.18: Admin Reset Password via Supabase Admin API
 *
 * Protected by AdminJwtGuard - requires admin authentication
 */
@Controller('api/admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly userFeaturesService: UserFeaturesService,
    private readonly supabaseAdminService: SupabaseAdminService,
    private readonly rgpdService: RgpdService,
  ) {}

  /**
   * Get user's feature flags (admin view)
   * GET /api/admin/users/:userId/features
   *
   * @param userId - User ID to retrieve features for
   * @returns UserFeaturesDto with current feature flags
   */
  @Get(':userId/features')
  async getUserFeatures(
    @Param('userId') userId: string,
  ): Promise<UserFeaturesDto> {
    this.logger.log(`Admin retrieving features for user ${userId}`);
    return this.userFeaturesService.getUserFeatures(userId);
  }

  /**
   * Update user's feature flags/permissions (admin action)
   * PATCH /api/admin/users/:userId/features
   * AC2: Admin can activate/deactivate debug mode access
   *
   * @param userId - User ID to update features for
   * @param dto - Feature flags to update
   * @returns Updated UserFeaturesDto
   */
  @Patch(':userId/features')
  async updateUserFeatures(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserFeaturesDto,
  ): Promise<UserFeaturesDto> {
    this.logger.log(
      `Admin updating features for user ${userId}: debug_mode_access=${dto.debug_mode_access}`,
    );

    const updatedFeatures =
      await this.userFeaturesService.updateDebugModeAccess(
        userId,
        dto.debug_mode_access,
      );

    this.logger.log(
      `Successfully updated features for user ${userId}: debug_mode_access=${updatedFeatures.debug_mode_access}`,
    );

    return updatedFeatures;
  }

  /**
   * Sync all Supabase Auth users → backend PostgreSQL
   * POST /api/admin/users/sync-from-supabase
   * Story 8.19: Sync utilisateurs Supabase → Backend
   *
   * Match by email: if email found in DB → overwrite values (including provider id).
   * If not found → create new record.
   * Note: to be migrated to Better Auth provider sync when Epic 15 is implemented.
   */
  @Post('sync-from-supabase')
  @HttpCode(HttpStatus.OK)
  async syncUsersFromSupabase(): Promise<{
    message: string;
    created: number;
    updated: number;
    unchanged: number;
  }> {
    this.logger.log('Admin triggering Supabase → backend user sync');
    const result = await this.rgpdService.syncUsersFromSupabase();
    this.logger.log(
      `Sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`,
    );
    return { message: 'Sync completed', ...result };
  }

  /**
   * Force reset a user's password via Supabase Admin API
   * POST /api/admin/users/:userId/reset-password
   * Story 8.18: Admin Reset Password
   *
   * Supabase is the source of truth — password never modified directly in PostgreSQL.
   * Note: to be migrated to Better Auth admin API when Epic 15 is implemented.
   */
  @Post(':userId/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('userId') userId: string,
    @Body() dto: ResetUserPasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Admin resetting password for user ${userId}`);
    await this.supabaseAdminService.resetUserPassword(userId, dto.newPassword);
    this.logger.log(`Password reset successfully for user ${userId}`);
    return { message: 'Password reset successfully' };
  }
}
