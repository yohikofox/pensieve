/**
 * Action Module
 * Supporting Domain for actionable tasks (Todos)
 *
 * Story 4.3 - Action Context Module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from './domain/entities/todo.entity';
import { TodoRepository } from './application/repositories/todo.repository';
import { DeadlineParserService } from './application/services/deadline-parser.service';
import { PriorityInferenceService } from './application/services/priority-inference.service';
import { TodosController } from './application/controllers/todos.controller';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [TypeOrmModule.forFeature([Todo]), AuthorizationModule],
  controllers: [TodosController],
  providers: [TodoRepository, DeadlineParserService, PriorityInferenceService],
  exports: [TodoRepository, DeadlineParserService, PriorityInferenceService],
})
export class ActionModule {}
