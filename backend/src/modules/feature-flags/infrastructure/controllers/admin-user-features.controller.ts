import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { AdminFeatureFlagsService } from '../../application/services/admin-feature-flags.service';
import { UpsertFeatureAssignmentDto } from '../../application/dtos/upsert-feature-assignment.dto';

/**
 * AdminUserFeaturesController — API admin pour les assignations feature par utilisateur
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC2, AC7)
 *
 * GET    /api/admin/users/:userId/features                       — features résolues (deny-wins)
 * PUT    /api/admin/users/:userId/features/:featureKey           — upsert assignation directe
 * DELETE /api/admin/users/:userId/features/:featureKey           — supprimer assignation directe
 *
 * Tous les endpoints sont protégés par AdminJwtGuard (AC7).
 * Remplace l'ancien GET et PATCH de AdminUsersController (Story 7.1 / legacy).
 */
@Controller('api/admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUserFeaturesController {
  private readonly logger = new Logger(AdminUserFeaturesController.name);

  constructor(private readonly adminService: AdminFeatureFlagsService) {}

  @Get(':userId/features')
  getUserFeatures(
    @Param('userId') userId: string,
  ): Promise<
    Record<
      string,
      { resolved: boolean; sources: Array<{ type: string; value: boolean }> }
    >
  > {
    this.logger.log(`Admin getting features for user ${userId}`);
    return this.adminService.getUserFeatures(userId);
  }

  @Put(':userId/features/:featureKey')
  @HttpCode(HttpStatus.OK)
  upsertAssignment(
    @Param('userId') userId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpsertFeatureAssignmentDto,
  ): Promise<{ key: string; value: boolean; source: string }> {
    this.logger.log(
      `Admin upserting feature '${featureKey}' for user ${userId}: ${dto.value}`,
    );
    return this.adminService.upsertUserAssignment(
      userId,
      featureKey,
      dto.value,
    );
  }

  @Delete(':userId/features/:featureKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAssignment(
    @Param('userId') userId: string,
    @Param('featureKey') featureKey: string,
  ): Promise<void> {
    this.logger.log(
      `Admin deleting feature assignment '${featureKey}' for user ${userId}`,
    );
    return this.adminService.deleteUserAssignment(userId, featureKey);
  }
}
