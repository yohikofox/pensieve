/**
 * Thoughts Controller
 * HTTP API endpoints for Thought management
 *
 * Provides CRUD operations with multi-level authorization:
 * - Permission-based access control (RBAC)
 * - Resource ownership verification
 * - Shared resource access via sharing endpoints
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ThoughtRepository } from '../repositories/thought.repository';
import { ThoughtDeleteService } from '../services/thought-delete.service';
import { isError } from '../../../../common/types/result.type';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { ResourceOwnershipGuard } from '../../../authorization/infrastructure/guards/resource-ownership.guard';
import { PermissionGuard } from '../../../authorization/infrastructure/guards/permission.guard';
import { RequireOwnership } from '../../../authorization/infrastructure/decorators/require-ownership.decorator';
import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { ResourceType } from '../../../authorization/core/enums/resource-type.enum';
import { ShareRole } from '../../../authorization/core/enums/share-role.enum';
import type { IAuthorizationService } from '../../../authorization/core/interfaces/authorization.interface';
import { ResourceShareRepository } from '../../../authorization/implementations/postgresql/repositories/resource-share.repository';

class CreateThoughtDto {
  captureId!: string;
  summary!: string;
  ideas?: string[];
  processingTimeMs?: number;
  confidenceScore?: number;
}

class ShareThoughtDto {
  userId!: string;
  role!: ShareRole;
  expiresAt?: string;
}

@Controller('api/thoughts')
export class ThoughtsController {
  private readonly logger = new Logger(ThoughtsController.name);

  constructor(
    private readonly thoughtRepository: ThoughtRepository,
    private readonly thoughtDeleteService: ThoughtDeleteService,
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
    private readonly resourceShareRepo: ResourceShareRepository,
  ) {}

  /**
   * Get all thoughts for the authenticated user
   * Authorization: PermissionGuard ensures user has thought.read permission
   */
  @Get()
  @UseGuards(SupabaseAuthGuard, PermissionGuard)
  @RequirePermission('thought.read')
  async listThoughts(@CurrentUser() user: User) {
    return await this.thoughtRepository.findByUserId(user.id);
  }

  /**
   * Get thought by ID
   * Authorization: ResourceOwnershipGuard ensures user owns the thought
   */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async getThoughtById(@Param('id') id: string) {
    const thought = await this.thoughtRepository.findById(id);
    if (!thought) {
      throw new NotFoundException('Thought not found');
    }

    return thought;
  }

  /**
   * Get thought by capture ID
   * Authorization: PermissionGuard ensures user has thought.read permission
   * Additional filtering by userId at service level
   */
  @Get('by-capture/:captureId')
  @UseGuards(SupabaseAuthGuard, PermissionGuard)
  @RequirePermission('thought.read')
  async getThoughtByCaptureId(
    @Param('captureId') captureId: string,
    @CurrentUser() user: User,
  ) {
    const thought = await this.thoughtRepository.findByCaptureId(captureId);

    if (!thought) {
      throw new NotFoundException('Thought not found for this capture');
    }

    // Ensure user owns the thought (additional security layer)
    if (thought.userId !== user.id) {
      throw new NotFoundException('Thought not found for this capture');
    }

    return thought;
  }

  /**
   * Create thought manually (rare scenario, mostly created by AI)
   * Authorization: PermissionGuard ensures user has thought.create permission
   */
  @Post()
  @UseGuards(SupabaseAuthGuard, PermissionGuard)
  @RequirePermission('thought.create')
  async createThought(
    @Body() dto: CreateThoughtDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`📝 Manual thought creation for capture ${dto.captureId}`);

    return await this.thoughtRepository.createWithIdeas(
      dto.captureId,
      user.id,
      dto.summary,
      dto.ideas || [],
      dto.processingTimeMs || 0,
      dto.confidenceScore,
    );
  }

  /**
   * Delete thought
   * Authorization: ResourceOwnershipGuard ensures user owns the thought
   *
   * Story 12.4 (ADR-026 R3): La suppression des Ideas liées est gérée
   * explicitement par ThoughtDeleteService via une transaction atomique.
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThought(@Param('id') id: string) {
    const result = await this.thoughtDeleteService.softDeleteWithRelated(id);
    if (isError(result)) {
      throw new InternalServerErrorException(result.error);
    }
  }

  // ========================================
  // Sharing Endpoints
  // ========================================

  /**
   * Share a thought with another user
   * Authorization: PermissionGuard checks thought.share permission (paid feature)
   *                ResourceOwnershipGuard ensures user owns the thought
   */
  @Post(':id/share')
  @UseGuards(SupabaseAuthGuard, PermissionGuard, ResourceOwnershipGuard)
  @RequirePermission('thought.share')
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async shareThought(
    @Param('id') id: string,
    @Body() dto: ShareThoughtDto,
    @CurrentUser() user: User,
  ) {
    await this.authService.shareResource({
      resourceType: ResourceType.THOUGHT,
      resourceId: id,
      ownerId: user.id,
      sharedWithId: dto.userId,
      shareRole: dto.role,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return { message: 'Thought shared successfully' };
  }

  /**
   * List all shares for a thought
   * Authorization: ResourceOwnershipGuard ensures user owns the thought
   */
  @Get(':id/shares')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async listShares(@Param('id') id: string) {
    const shares = await this.resourceShareRepo.findByResourceId(
      ResourceType.THOUGHT,
      id,
    );

    return shares.map((share) => ({
      id: share.id,
      sharedWithId: share.sharedWithId,
      role: share.shareRole?.name,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    }));
  }

  /**
   * Revoke a share
   * Authorization: ResourceOwnershipGuard ensures user owns the thought
   */
  @Delete(':id/shares/:shareId')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(@Param('shareId') shareId: string) {
    await this.authService.revokeShare(shareId);
  }
}
