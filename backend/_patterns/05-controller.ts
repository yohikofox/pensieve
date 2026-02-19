/**
 * PATTERN: Controller NestJS avec autorisation
 *
 * Source: src/modules/knowledge/application/controllers/thoughts.controller.ts
 *
 * RÈGLES:
 * - Toujours @UseGuards(BetterAuthGuard, ...) en premier
 * - Permission-based (RBAC) : PermissionGuard + @RequirePermission('resource.action')
 * - Ownership-based : ResourceOwnershipGuard + @RequireOwnership({ resourceType, paramKey })
 * - Jamais de logique métier dans le controller — déléguer au service/repository
 * - Seul le controller throw des HttpException (pas les services)
 * - Le controller consomme Result<T> via isError() / result.type
 * - Format permission : '<resource>.<action>' (ex: 'thought.read', 'capture.delete')
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
import { isError, success } from '../src/common/types/result.type';
import { BetterAuthGuard } from '../src/auth/guards/better-auth.guard';
import { ResourceOwnershipGuard } from '../src/modules/authorization/infrastructure/guards/resource-ownership.guard';
import { PermissionGuard } from '../src/modules/authorization/infrastructure/guards/permission.guard';
import { RequireOwnership } from '../src/modules/authorization/infrastructure/decorators/require-ownership.decorator';
import { RequirePermission } from '../src/modules/authorization/infrastructure/decorators/require-permission.decorator';
import { CurrentUser } from '../src/modules/authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../src/modules/authorization/infrastructure/decorators/current-user.decorator';
import { ResourceType } from '../src/modules/authorization/core/enums/resource-type.enum';
import type { IAuthorizationService } from '../src/modules/authorization/core/interfaces/authorization.interface';

// DTO défini dans le fichier controller (simple) ou dans domain/dtos/ (si réutilisé)
class CreateExampleDto {
  name!: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Controller avec autorisation complète
// ─────────────────────────────────────────────────────────────────────────────

@Controller('api/examples')
export class ExamplesController {
  private readonly logger = new Logger(ExamplesController.name);

  constructor(
    // Repository ou service injecté directement (pas de token si classe concrète)
    // private readonly exampleRepository: ExampleRepository,
    // private readonly exampleDeleteService: ExampleDeleteService,

    // Token string pour les interfaces swappables (authorization, stores...)
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  /**
   * Liste — permission-based (RBAC)
   * Pattern : BetterAuthGuard + PermissionGuard + @RequirePermission
   */
  @Get()
  @UseGuards(BetterAuthGuard, PermissionGuard)
  @RequirePermission('example.read')
  async listExamples(@CurrentUser() user: User) {
    this.logger.log('example.list', { userId: user.id });
    return await Promise.resolve([]); // simulation — remplacer par this.exampleRepository.findByOwner(user.id)
  }

  /**
   * Lecture par ID — ownership-based
   * Pattern : BetterAuthGuard + ResourceOwnershipGuard + @RequireOwnership
   */
  @Get(':id')
  @UseGuards(BetterAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async getExample(@Param('id') id: string) {
    const example = await Promise.resolve(
      null as { id: string; name: string } | null,
    ); // simulation — remplacer par this.exampleRepository.findById(id)
    // ✅ Controller throw des HttpException (pas le service)
    if (!example) {
      throw new NotFoundException(`Example not found: ${id}`);
    }
    return example;
  }

  /**
   * Création — permission-based
   */
  @Post()
  @UseGuards(BetterAuthGuard, PermissionGuard)
  @RequirePermission('example.create')
  async createExample(
    @Body() dto: CreateExampleDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`example.create requested by ${user.id}`);
    return await Promise.resolve({ name: dto.name }); // simulation — remplacer par this.exampleRepository.create(dto.name, user.id)
  }

  /**
   * Suppression — ownership + Result Pattern
   */
  @Delete(':id')
  @UseGuards(BetterAuthGuard, ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExample(@Param('id') id: string) {
    const result = await Promise.resolve(success(undefined)); // simulation — remplacer par this.exampleDeleteService.softDeleteWithRelated(id)
    // ✅ Consommer Result<T> — throw uniquement ici
    if (isError(result)) {
      throw new InternalServerErrorException(result.error);
    }
    this.logger.log('example.deleted', { id });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards disponibles et leur rôle
// ─────────────────────────────────────────────────────────────────────────────
//
// BetterAuthGuard        → valide la session Better Auth, popule @CurrentUser()
// PermissionGuard          → vérifie permission RBAC via @RequirePermission()
// ResourceOwnershipGuard   → vérifie ownership via @RequireOwnership()
// ResourceShareGuard       → vérifie accès partagé via @AllowSharedAccess()
//
// Ordre recommandé : [BetterAuthGuard, PermissionGuard, ResourceOwnershipGuard]

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDITS dans un controller
// ─────────────────────────────────────────────────────────────────────────────

// ❌ Logique métier dans le controller
// if (dto.name.length > 100) { throw new BadRequestException('Name too long'); }

// ❌ Accès DB direct sans passer par le repository
// const result = await this.dataSource.query('SELECT * FROM examples');

// ❌ throw dans un service (le controller throw, le service retourne Result)
