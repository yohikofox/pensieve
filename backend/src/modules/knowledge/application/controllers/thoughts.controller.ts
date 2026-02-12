/**
 * Thoughts Controller
 * HTTP API endpoints for Thought management
 *
 * Provides CRUD operations with multi-level authorization:
 * - Permission-based access control (RBAC)
 * - Resource ownership verification
 * - Shared resource access (future)
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
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ThoughtRepository } from '../repositories/thought.repository';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { ResourceOwnershipGuard } from '../../../authorization/infrastructure/guards/resource-ownership.guard';
import { PermissionGuard } from '../../../authorization/infrastructure/guards/permission.guard';
import { RequireOwnership } from '../../../authorization/infrastructure/decorators/require-ownership.decorator';
import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { ResourceType } from '../../../authorization/core/enums/resource-type.enum';

/**
 * DTO for creating a thought (manual creation scenario)
 * Note: In production, thoughts are primarily created by AI digestion
 */
class CreateThoughtDto {
  captureId!: string;
  summary!: string;
  ideas?: string[];
  processingTimeMs?: number;
  confidenceScore?: number;
}

@Controller('api/thoughts')
export class ThoughtsController {
  private readonly logger = new Logger(ThoughtsController.name);

  constructor(private readonly thoughtRepository: ThoughtRepository) {}

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
   * Cascade deletes associated ideas
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThought(@Param('id') id: string) {
    await this.thoughtRepository.delete(id);
  }
}
