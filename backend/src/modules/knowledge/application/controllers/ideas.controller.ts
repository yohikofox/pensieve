/**
 * Ideas Controller
 * HTTP API endpoints for Idea management
 *
 * Provides CRUD operations with multi-level authorization:
 * - Permission-based access control (RBAC)
 * - Resource ownership verification
 * - Shared resource access (future)
 *
 * Ideas are typically created through AI digestion,
 * but can be managed individually for corrections
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { IdeaRepository } from '../repositories/idea.repository';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { ResourceOwnershipGuard } from '../../../authorization/infrastructure/guards/resource-ownership.guard';
import { PermissionGuard } from '../../../authorization/infrastructure/guards/permission.guard';
import { RequireOwnership } from '../../../authorization/infrastructure/decorators/require-ownership.decorator';
import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { ResourceType } from '../../../authorization/core/enums/resource-type.enum';

/**
 * DTO for creating an idea manually
 */
class CreateIdeaDto {
  thoughtId!: string;
  text!: string;
  orderIndex?: number;
}

/**
 * DTO for updating an idea
 */
class UpdateIdeaDto {
  text!: string;
}

@Controller('api/ideas')
export class IdeasController {
  private readonly logger = new Logger(IdeasController.name);

  constructor(private readonly ideaRepository: IdeaRepository) {}

  /**
   * Get all ideas for the authenticated user
   * Authorization: PermissionGuard ensures user has idea.read permission
   */
  @Get()
  @UseGuards(BetterAuthGuard, PermissionGuard)
  @RequirePermission('idea.read')
  async listIdeas(@CurrentUser() user: User) {
    return await this.ideaRepository.findByUserId(user.id);
  }

  /**
   * Get idea by ID
   * Authorization: ResourceOwnershipGuard ensures user owns the idea
   */
  @Get(':id')
  @UseGuards(BetterAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.IDEA, paramKey: 'id' })
  async getIdeaById(@Param('id') id: string) {
    const idea = await this.ideaRepository.findById(id);
    if (!idea) {
      throw new NotFoundException('Idea not found');
    }

    return idea;
  }

  /**
   * Get all ideas for a thought
   * Authorization: PermissionGuard ensures user has idea.read permission
   * Additional filtering by userId at service level
   */
  @Get('by-thought/:thoughtId')
  @UseGuards(BetterAuthGuard, PermissionGuard)
  @RequirePermission('idea.read')
  async getIdeasByThought(
    @Param('thoughtId') thoughtId: string,
    @CurrentUser() user: User,
  ) {
    const ideas = await this.ideaRepository.findByThoughtId(thoughtId);

    // Filter to only return user's own ideas
    return ideas.filter((idea) => idea.ownerId === user.id);
  }

  /**
   * Create idea manually
   * Authorization: PermissionGuard ensures user has idea.create permission
   */
  @Post()
  @UseGuards(BetterAuthGuard, PermissionGuard)
  @RequirePermission('idea.create')
  async createIdea(@Body() dto: CreateIdeaDto, @CurrentUser() user: User) {
    this.logger.log(`📝 Manual idea creation for thought ${dto.thoughtId}`);

    return await this.ideaRepository.create(
      dto.thoughtId,
      user.id,
      dto.text,
      dto.orderIndex,
    );
  }

  /**
   * Update idea text (user correction)
   * Authorization: ResourceOwnershipGuard ensures user owns the idea
   */
  @Put(':id')
  @UseGuards(BetterAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.IDEA, paramKey: 'id' })
  async updateIdea(@Param('id') id: string, @Body() dto: UpdateIdeaDto) {
    const idea = await this.ideaRepository.update(id, dto.text);

    if (!idea) {
      throw new NotFoundException('Idea not found');
    }

    return idea;
  }

  /**
   * Delete idea (false positive correction)
   * Authorization: ResourceOwnershipGuard ensures user owns the idea
   */
  @Delete(':id')
  @UseGuards(BetterAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.IDEA, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIdea(@Param('id') id: string) {
    await this.ideaRepository.delete(id);
  }
}
