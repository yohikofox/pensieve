/**
 * Todos Controller
 * HTTP API endpoints for Todo management
 *
 * Story 4.3 Task 7: User Correction Endpoint (AC7)
 * Task 9: Mobile Feed Display Preparation (Backend API)
 *
 * UPDATED: Migrated to use authorization guards instead of manual checks
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  Query,
  Logger,
} from '@nestjs/common';
import { TodoRepository } from '../repositories/todo.repository';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { ResourceOwnershipGuard } from '../../../authorization/infrastructure/guards/resource-ownership.guard';
import { PermissionGuard } from '../../../authorization/infrastructure/guards/permission.guard';
import { RequireOwnership } from '../../../authorization/infrastructure/decorators/require-ownership.decorator';
import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { ResourceType } from '../../../authorization/core/enums/resource-type.enum';

@Controller('api/todos')
export class TodosController {
  private readonly logger = new Logger(TodosController.name);

  constructor(private readonly todoRepository: TodoRepository) {}

  /**
   * Get todo by ID
   * Task 9 Subtask 9.1: GET /api/thoughts/:id/todos endpoint
   *
   * Authorization: ResourceOwnershipGuard ensures user owns the todo
   */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.TODO, paramKey: 'id' })
  async getTodoById(@Param('id') id: string) {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    return todo;
  }

  /**
   * Delete todo (AC7: False Positive Correction)
   * Task 7 Subtask 7.1-7.3: DELETE /api/todos/:id endpoint
   *
   * Allows users to remove incorrect todos extracted by GPT
   * Authorization: ResourceOwnershipGuard ensures user owns the todo
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.TODO, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTodo(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('reason') reason?: string,
  ) {
    // Subtask 7.3: Collect feedback reason (optional)
    if (reason) {
      this.logger.log(
        `📝 Todo deletion feedback: todoId=${id}, userId=${user.id}, reason=${reason}`,
      );
      // TODO: Store feedback in analytics system for GPT improvement (post-MVP)
    }

    await this.todoRepository.delete(id);
  }

  /**
   * Get todos for a thought
   * Task 9 Subtask 9.1: GET /api/thoughts/:id/todos endpoint
   *
   * Authorization: PermissionGuard ensures user has todo.read permission
   * Filtering by userId is still needed at service level
   */
  @Get('by-thought/:thoughtId')
  @UseGuards(SupabaseAuthGuard, PermissionGuard)
  @RequirePermission('todo.read')
  async getTodosByThought(
    @Param('thoughtId') thoughtId: string,
    @CurrentUser() user: User,
  ) {
    const todos = await this.todoRepository.findByThoughtId(thoughtId);

    // Filter to only return user's own todos (NFR13)
    return todos.filter((todo) => todo.ownerId === user.id);
  }
}
