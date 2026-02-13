/**
 * Sync Controller
 * HTTP API endpoints for mobile ↔ backend synchronization
 *
 * Story 6.1 - Task 1: Backend Sync Endpoint Infrastructure
 * Implements: AC1 (sync endpoints), AC2 (authentication)
 * Protocol: ADR-009 lastPulledAt + last_modified pattern
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SyncService } from '../services/sync.service';
import { PullRequestDto } from '../dto/pull-request.dto';
import { PushRequestDto } from '../dto/push-request.dto';
import { SyncResponseDto } from '../dto/sync-response.dto';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';

@Controller('api/sync')
@UseGuards(SupabaseAuthGuard) // AC1: JWT authentication required
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * Pull endpoint - Client requests server changes
   *
   * GET /api/sync/pull?last_pulled_at=1736759400000
   *
   * Returns all server changes since last_pulled_at timestamp
   * Client should save response.timestamp for next pull
   *
   * AC1: Endpoint accepts WatermelonDB sync protocol payloads
   * AC1: Endpoint handles authentication via JWT tokens
   * AC1: Endpoint validates user isolation (NFR13)
   */
  @Get('pull')
  async pull(
    @CurrentUser() user: User,
    @Query('last_pulled_at') lastPulledAt?: string,
  ): Promise<SyncResponseDto> {
    const userId = user.id;
    const timestamp = lastPulledAt ? parseInt(lastPulledAt, 10) : 0;

    this.logger.log(
      `📥 PULL request from user ${userId}, lastPulledAt: ${timestamp}`,
    );

    return this.syncService.processPull(userId, timestamp);
  }

  /**
   * Push endpoint - Client sends local changes
   *
   * POST /api/sync/push
   * Body: { last_pulled_at: number, changes: {...} }
   *
   * Accepts client changes, detects conflicts, returns server changes
   *
   * AC4: Changes are validated for data integrity
   * AC4: User permissions are verified (NFR13: user can only sync their own data)
   * AC4: Changes are applied to PostgreSQL database
   * AC4: Sync response follows OP-SQLite sync protocol format
   */
  @Post('push')
  async push(
    @CurrentUser() user: User,
    @Body() dto: PushRequestDto,
  ): Promise<SyncResponseDto> {
    const userId = user.id;

    this.logger.log(
      `📤 PUSH request from user ${userId}, lastPulledAt: ${dto.last_pulled_at}`,
    );

    return this.syncService.processPush(
      userId,
      dto.changes,
      dto.last_pulled_at,
    );
  }
}
