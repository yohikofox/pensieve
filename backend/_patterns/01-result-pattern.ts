/**
 * PATTERN: Result Pattern — Backend (ADR-023)
 *
 * Source: src/common/types/result.type.ts
 *
 * RÈGLE: Les services applicatifs DOIVENT retourner Result<T>.
 * JAMAIS throw dans un service (les controllers peuvent throw des HttpException).
 *
 * Note: Le Result Pattern backend est différent du mobile.
 *   - Mobile : RepositoryResult<T> (8 types, pour SQLite)
 *   - Backend : Result<T> (5 types, pour PostgreSQL/transactions)
 */

import {
  Result,
  success,
  notFound,
  transactionError,
  validationError,
  isSuccess,
  isError,
} from '../src/common/types/result.type';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : service retournant Result<T>
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
class ExampleService {
  private readonly logger = new Logger(ExampleService.name);

  constructor(private readonly dataSource: DataSource) {}

  async deleteEntity(id: string): Promise<Result<void>> {
    try {
      await this.dataSource.transaction(async (manager) => {
        // ... opérations atomiques
      });

      return success(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('entity.delete.failed', { id, error: message });
      return transactionError(`Failed to delete entity ${id}: ${message}`);
    }
  }

  async findEntity(id: string): Promise<Result<{ id: string; name: string }>> {
    try {
      const entity = null as { id: string; name: string } | null; // simulation

      if (!entity) {
        return notFound(`Entity not found: ${id}`);
      }

      return success(entity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return transactionError(`Failed to find entity: ${message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : controller consommant Result<T>
// ─────────────────────────────────────────────────────────────────────────────

import {
  Controller,
  Delete,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

@Controller('api/examples')
class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Delete(':id')
  async deleteExample(@Param('id') id: string) {
    const result = await this.service.deleteEntity(id);

    // ✅ Seul le controller throw des HttpException
    if (isError(result)) {
      throw new InternalServerErrorException(result.error);
    }
    // HTTP 200 implicite (ou ajouter @HttpCode(HttpStatus.NO_CONTENT))
  }

  @Get(':id')
  async getExample(@Param('id') id: string) {
    const result = await this.service.findEntity(id);

    if (result.type === 'not_found') {
      throw new NotFoundException(result.error);
    }

    if (isError(result)) {
      throw new InternalServerErrorException(result.error);
    }

    return result.data;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types disponibles dans Result<T>
// ─────────────────────────────────────────────────────────────────────────────
//
// success(data)          → type: 'success'
// notFound(error)        → type: 'not_found'
// transactionError(msg)  → type: 'transaction_error'
// validationError(msg)   → type: 'validation_error'
//
// isSuccess(result)      → type guard
// isError(result)        → boolean (tout sauf 'success')

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : throw dans un service applicatif
// ─────────────────────────────────────────────────────────────────────────────

class WrongService {
  async deleteEntity(id: string): Promise<void> {
    // ❌ JAMAIS ça dans un service
    throw new Error('Not found');
    // ❌ JAMAIS ça non plus
    throw new NotFoundException('Entity not found');
  }
}
