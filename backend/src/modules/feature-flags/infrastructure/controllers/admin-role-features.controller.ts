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
 * AdminRoleFeaturesController — API admin pour les assignations feature par rôle
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC3, AC7)
 *
 * GET    /api/admin/roles/:roleId/features                     — assignations du rôle
 * PUT    /api/admin/roles/:roleId/features/:featureKey         — upsert assignation
 * DELETE /api/admin/roles/:roleId/features/:featureKey         — supprimer assignation
 *
 * Tous les endpoints sont protégés par AdminJwtGuard (AC7).
 */
@Controller('api/admin/roles')
@UseGuards(AdminJwtGuard)
export class AdminRoleFeaturesController {
  private readonly logger = new Logger(AdminRoleFeaturesController.name);

  constructor(private readonly adminService: AdminFeatureFlagsService) {}

  @Get(':roleId/features')
  getRoleAssignments(
    @Param('roleId') roleId: string,
  ): Promise<Array<{ featureKey: string; value: boolean }>> {
    this.logger.log(`Admin getting feature assignments for role ${roleId}`);
    return this.adminService.getRoleAssignments(roleId);
  }

  @Put(':roleId/features/:featureKey')
  @HttpCode(HttpStatus.OK)
  upsertAssignment(
    @Param('roleId') roleId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpsertFeatureAssignmentDto,
  ): Promise<{ key: string; value: boolean; source: string }> {
    this.logger.log(
      `Admin upserting feature '${featureKey}' for role ${roleId}: ${dto.value}`,
    );
    return this.adminService.upsertRoleAssignment(
      roleId,
      featureKey,
      dto.value,
    );
  }

  @Delete(':roleId/features/:featureKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAssignment(
    @Param('roleId') roleId: string,
    @Param('featureKey') featureKey: string,
  ): Promise<void> {
    this.logger.log(
      `Admin deleting feature assignment '${featureKey}' for role ${roleId}`,
    );
    return this.adminService.deleteRoleAssignment(roleId, featureKey);
  }
}
