/**
 * Todos Controller
 * HTTP API endpoints for Todo management
 *
 * Story 4.3 Task 7: User Correction Endpoint (AC7)
 * Task 9: Mobile Feed Display Preparation (Backend API)
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  Query,
  Logger,
} from '@nestjs/common';
import { TodoRepository } from '../repositories/todo.repository';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../../shared/infrastructure/types/authenticated-request';

@Controller('api/todos')
export class TodosController {
  private readonly logger = new Logger(TodosController.name);

  constructor(private readonly todoRepository: TodoRepository) {}

  /**
   * Get todo by ID
   * Task 9 Subtask 9.1: GET /api/thoughts/:id/todos endpoint
   */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  async getTodoById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    // User can only access their own todos (NFR13)
    if (todo.userId !== req.user.id) {
      throw new ForbiddenException('Access denied');
    }

    return todo;
  }

  /**
   * Delete todo (AC7: False Positive Correction)
   * Task 7 Subtask 7.1-7.3: DELETE /api/todos/:id endpoint
   *
   * Allows users to remove incorrect todos extracted by GPT
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTodo(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('reason') reason?: string,
  ) {
    // Subtask 7.2: User authorization check
    const todo = await this.todoRepository.findById(id);
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    // Verify that the authenticated user owns this todo (NFR13)
    if (todo.userId !== req.user.id) {
      throw new ForbiddenException('You can only delete your own todos');
    }

    // Subtask 7.3: Collect feedback reason (optional)
    if (reason) {
      this.logger.log(
        `📝 Todo deletion feedback: todoId=${id}, userId=${req.user.id}, reason=${reason}`,
      );
      // TODO: Store feedback in analytics system for GPT improvement (post-MVP)
    }

    await this.todoRepository.delete(id);
  }

  /**
   * Get todos for a thought
   * Task 9 Subtask 9.1: GET /api/thoughts/:id/todos endpoint
   */
  @Get('by-thought/:thoughtId')
  @UseGuards(SupabaseAuthGuard)
  async getTodosByThought(
    @Param('thoughtId') thoughtId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const todos = await this.todoRepository.findByThoughtId(thoughtId);

    // Filter to only return user's own todos (NFR13)
    return todos.filter((todo) => todo.userId === req.user.id);
  }
}
