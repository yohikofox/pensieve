import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
  Get,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { UserFeaturesService } from '../../../identity/application/services/user-features.service';
import { UpdateUserFeaturesDto } from '../../application/dtos/update-user-features.dto';
import { UserFeaturesDto } from '../../../identity/application/dtos/user-features.dto';

/**
 * Admin controller for managing user features/permissions
 * Story 7.1: Support Mode avec Permissions Backend - Task 2
 *
 * Protected by AdminJwtGuard - requires admin authentication
 */
@Controller('api/admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private readonly userFeaturesService: UserFeaturesService) {}

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
}
