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
 * AdminPermissionFeaturesController — API admin pour les assignations feature par permission
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC4, AC7)
 *
 * GET    /api/admin/permissions/:permissionId/features                     — assignations de la permission
 * PUT    /api/admin/permissions/:permissionId/features/:featureKey         — upsert assignation
 * DELETE /api/admin/permissions/:permissionId/features/:featureKey         — supprimer assignation
 *
 * Tous les endpoints sont protégés par AdminJwtGuard (AC7).
 */
@Controller('api/admin/permissions')
@UseGuards(AdminJwtGuard)
export class AdminPermissionFeaturesController {
  private readonly logger = new Logger(AdminPermissionFeaturesController.name);

  constructor(private readonly adminService: AdminFeatureFlagsService) {}

  @Get(':permissionId/features')
  getPermissionAssignments(
    @Param('permissionId') permissionId: string,
  ): Promise<Array<{ featureKey: string; value: boolean }>> {
    this.logger.log(
      `Admin getting feature assignments for permission ${permissionId}`,
    );
    return this.adminService.getPermissionAssignments(permissionId);
  }

  @Put(':permissionId/features/:featureKey')
  @HttpCode(HttpStatus.OK)
  upsertAssignment(
    @Param('permissionId') permissionId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpsertFeatureAssignmentDto,
  ): Promise<{ key: string; value: boolean; source: string }> {
    this.logger.log(
      `Admin upserting feature '${featureKey}' for permission ${permissionId}: ${dto.value}`,
    );
    return this.adminService.upsertPermissionAssignment(
      permissionId,
      featureKey,
      dto.value,
    );
  }

  @Delete(':permissionId/features/:featureKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAssignment(
    @Param('permissionId') permissionId: string,
    @Param('featureKey') featureKey: string,
  ): Promise<void> {
    this.logger.log(
      `Admin deleting feature assignment '${featureKey}' for permission ${permissionId}`,
    );
    return this.adminService.deletePermissionAssignment(permissionId, featureKey);
  }
}
