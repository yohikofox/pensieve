import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { PermissionGuard } from '../../../authorization/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';
import type { IAuthorizationService } from '../../../authorization/core/interfaces/authorization.interface';
import { PatService } from '../services/pat.service';
import { PATAuditService } from '../services/pat-audit.service';
import { CreatePatDto } from '../dto/create-pat.dto';
import { UpdatePatDto } from '../dto/update-pat.dto';
import { RenewPatDto } from '../dto/renew-pat.dto';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

@Controller('api/auth/pat')
@UseGuards(BetterAuthGuard, PermissionGuard)
export class PatController {
  constructor(
    private readonly patService: PatService,
    private readonly patAuditService: PATAuditService,
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  /** GET /api/auth/pat/audit — Consulter les logs d'audit (déclaré avant /:id) */
  @Get('audit')
  @RequirePermission('pat.manage')
  async getAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('userId') targetUserId?: string,
    @Query('limit') limitStr?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 100, 500) : 100;
    return this.patAuditService.findByUserId(userId, limit);
  }

  /** POST /api/auth/pat — Générer un nouveau PAT */
  @Post()
  @RequirePermission('pat.manage')
  async generate(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePatDto,
    @Query('userId') targetUserId?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    const auditInfo =
      targetUserId && targetUserId !== req.user.id
        ? { adminId: req.user.id }
        : undefined;
    return this.patService.generate(userId, dto, auditInfo);
  }

  /** GET /api/auth/pat — Lister les PATs */
  @Get()
  @RequirePermission('pat.manage')
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('userId') targetUserId?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    return this.patService.findAll(userId);
  }

  /** PATCH /api/auth/pat/:id — Modifier nom/scopes */
  @Patch(':id')
  @RequirePermission('pat.manage')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatDto,
    @Query('userId') targetUserId?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    return this.patService.update(id, userId, dto);
  }

  /** POST /api/auth/pat/:id/renew — Renouveler un PAT */
  @Post(':id/renew')
  @RequirePermission('pat.manage')
  async renew(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewPatDto,
    @Query('userId') targetUserId?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    const auditInfo =
      targetUserId && targetUserId !== req.user.id
        ? { adminId: req.user.id }
        : undefined;
    return this.patService.renew(id, userId, dto, auditInfo);
  }

  /** DELETE /api/auth/pat/:id — Révoquer un PAT */
  @Delete(':id')
  @RequirePermission('pat.manage')
  async revoke(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('userId') targetUserId?: string,
  ) {
    const userId = await this.resolveUserId(req, targetUserId);
    const auditInfo =
      targetUserId && targetUserId !== req.user.id
        ? { adminId: req.user.id }
        : undefined;
    await this.patService.revoke(id, userId, auditInfo);
    return { success: true };
  }

  /**
   * Résout l'userId cible pour les opérations PAT.
   *
   * Règles AC9 :
   * - Un utilisateur normal ne peut cibler que lui-même.
   * - Un admin peut cibler un utilisateur non-admin via ?userId=.
   * - Un admin NE PEUT PAS cibler un autre admin (restriction anti-privilege-escalation).
   */
  private async resolveUserId(
    req: AuthenticatedRequest,
    targetUserId?: string,
  ): Promise<string> {
    if (!targetUserId || targetUserId === req.user.id) {
      return req.user.id;
    }

    // Cross-user : le requérant doit être admin
    if (req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Accès refusé : vous ne pouvez gérer que vos propres PATs',
      );
    }

    // AC9 — Un admin ne peut pas gérer les PATs d'un autre admin
    const targetIsAdmin = await this.authService.hasPermission({
      userId: targetUserId,
      permission: 'pat.admin',
    });

    if (targetIsAdmin) {
      throw new ForbiddenException(
        "Accès refusé : impossible de gérer les PATs d'un autre administrateur",
      );
    }

    return targetUserId;
  }
}
