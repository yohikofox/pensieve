import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { BetterAuthAdminService } from '../../../rgpd/application/services/better-auth-admin.service';
import { RgpdService } from '../../../rgpd/application/services/rgpd.service';
import { ResetUserPasswordDto } from '../../application/dtos/reset-user-password.dto';

/**
 * Admin controller for managing users
 * Story 7.1: Support Mode avec Permissions Backend - Task 2
 * Story 8.18: Admin Reset Password
 * Story 24.2: GET/PATCH :userId/features supprimés — délégués à AdminUserFeaturesController
 *
 * Protected by AdminJwtGuard - requires admin authentication
 */
@Controller('api/admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly betterAuthAdminService: BetterAuthAdminService,
    private readonly rgpdService: RgpdService,
  ) {}

  /**
   * Sync Better Auth users → backend PostgreSQL
   * POST /api/admin/users/sync
   * Story 8.19: Sync utilisateurs Better Auth → Backend
   *
   * Match by email: if email found in DB → overwrite values (including provider id).
   * If not found → create new record.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUsers(): Promise<{
    message: string;
    created: number;
    updated: number;
    unchanged: number;
  }> {
    this.logger.log('Admin triggering Better Auth → backend user sync');
    const result = await this.rgpdService.syncUsers();
    this.logger.log(
      `Sync complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`,
    );
    return { message: 'Sync completed', ...result };
  }

  /**
   * Force reset a user's password via Better Auth admin API
   * POST /api/admin/users/:userId/reset-password
   * Story 8.18: Admin Reset Password
   */
  @Post(':userId/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('userId') userId: string,
    @Body() dto: ResetUserPasswordDto,
  ): Promise<{ message: string }> {
    this.logger.log(`Admin resetting password for user ${userId}`);
    await this.betterAuthAdminService.resetUserPassword(
      userId,
      dto.newPassword,
    );
    this.logger.log(`Password reset successfully for user ${userId}`);
    return { message: 'Password reset successfully' };
  }
}
