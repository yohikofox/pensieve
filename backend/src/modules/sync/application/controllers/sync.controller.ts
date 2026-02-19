import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { SyncService } from '../services/sync.service';
import { PullRequestDto } from '../dto/pull-request.dto';
import { PushRequestDto } from '../dto/push-request.dto';
import { SyncResponseDto } from '../dto/sync-response.dto';

/**
 * Sync Controller (AC1 - Task 1.1)
 *
 * Exposes sync endpoints:
 * - GET  /api/sync/pull  - Fetch server changes
 * - POST /api/sync/push  - Send client changes
 *
 * Authentication: JWT via BetterAuthGuard (Task 1.2)
 * User Isolation: userId extracted from JWT (NFR13)
 */
@Controller('api/sync')
@UseGuards(BetterAuthGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * PULL endpoint: Fetch server changes since lastPulledAt
   *
   * GET /api/sync/pull?lastPulledAt=1736759400000
   *
   * Returns: { changes: {...}, timestamp: now() }
   */
  @Get('pull')
  @HttpCode(HttpStatus.OK)
  async pull(
    @Request() req: any,
    @Query() dto: PullRequestDto,
  ): Promise<SyncResponseDto> {
    const userId = req.user?.id;

    if (!userId) {
      this.logger.error('Missing userId in JWT token');
      throw new Error('Unauthorized: userId not found in token');
    }

    this.logger.debug(
      `PULL request from user ${userId} with lastPulledAt ${dto.lastPulledAt || 0}`,
    );

    return this.syncService.processPull(userId, dto);
  }

  /**
   * PUSH endpoint: Send client changes to server
   *
   * POST /api/sync/push
   * Body: { lastPulledAt, changes: {...} }
   *
   * Returns: { changes: {...}, timestamp: now(), conflicts?: [...] }
   */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  async push(
    @Request() req: any,
    @Body() dto: PushRequestDto,
  ): Promise<SyncResponseDto> {
    const userId = req.user?.id;

    if (!userId) {
      this.logger.error('Missing userId in JWT token');
      throw new Error('Unauthorized: userId not found in token');
    }

    this.logger.debug(
      `PUSH request from user ${userId} with lastPulledAt ${dto.lastPulledAt}`,
    );

    return this.syncService.processPush(userId, dto);
  }
}
