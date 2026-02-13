import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { User } from '../decorators/current-user.decorator';
import { SubscriptionRepository } from '../../implementations/postgresql/repositories/subscription.repository';

class UpgradeSubscriptionDto {
  tierName!: string;
}

@Controller('api/subscription')
@UseGuards(SupabaseAuthGuard)
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionRepo: SubscriptionRepository) {}

  /**
   * Get current user's subscription
   * GET /api/subscription
   */
  @Get()
  async getCurrentSubscription(@CurrentUser() user: User) {
    const subscription = await this.subscriptionRepo.findActiveByUserId(
      user.id,
    );

    if (!subscription) {
      return { tier: 'free', status: 'active', expiresAt: null };
    }

    return {
      id: subscription.id,
      tier: subscription.tier?.name || 'free',
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      createdAt: subscription.createdAt,
    };
  }

  /**
   * Get permissions included in current subscription
   * GET /api/subscription/permissions
   */
  @Get('permissions')
  async getSubscriptionPermissions(@CurrentUser() user: User) {
    const permissions = await this.subscriptionRepo.findPermissionsByUserId(
      user.id,
    );

    return permissions.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      isPaidFeature: p.isPaidFeature,
    }));
  }

  /**
   * Upgrade subscription (placeholder)
   * POST /api/subscription/upgrade
   *
   * TODO: Integrate with payment provider (Stripe, etc.)
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  async upgradeSubscription(
    @Body() dto: UpgradeSubscriptionDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(
      `Upgrade requested by user ${user.id} to tier "${dto.tierName}"`,
    );

    throw new NotFoundException(
      'Subscription upgrade is not yet available. Coming soon.',
    );
  }
}
