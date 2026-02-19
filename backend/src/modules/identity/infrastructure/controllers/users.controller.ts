import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { UserFeaturesService } from '../../application/services/user-features.service';
import { UserFeaturesDto } from '../../application/dtos/user-features.dto';

/**
 * Controller for user-related endpoints
 * Story 7.1: Support Mode avec Permissions Backend
 */
@Controller('api/users')
export class UsersController {
  constructor(private readonly userFeaturesService: UserFeaturesService) {}

  /**
   * Get user feature flags/permissions
   * AC1: Protected by authentication, users can only access their own features
   *
   * @param userId - User ID from URL parameter
   * @param currentUser - Authenticated user from JWT
   * @returns UserFeaturesDto with current feature flags
   * @throws ForbiddenException if user tries to access another user's features
   */
  @Get(':userId/features')
  @UseGuards(BetterAuthGuard)
  async getUserFeatures(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserFeaturesDto> {
    // AC1: Un utilisateur ne peut accéder qu'à ses propres permissions
    if (currentUser.id !== userId) {
      throw new ForbiddenException(
        'You can only access your own feature permissions',
      );
    }

    return this.userFeaturesService.getUserFeatures(userId);
  }
}
