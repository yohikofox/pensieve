import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TraceContext } from '../../../../common/trace/trace.context';
import { PatRepository } from '../repositories/pat.repository';
import { SCOPES_KEY } from './require-scopes.decorator';

/**
 * PATGuard — Authentification via Personal Access Token (Story 27.1)
 *
 * Vérifie le token `Authorization: Bearer pns_...` :
 * 1. Hash SHA-256 → recherche en base
 * 2. Vérifie non-révoqué + non-expiré
 * 3. Vérifie les scopes requis (via @RequireScopes)
 * 4. Met à jour last_used_at en fire-and-forget
 * 5. Enrichit TraceContext avec patId/userId
 */
@Injectable()
export class PatGuard implements CanActivate {
  constructor(
    private readonly patRepository: PatRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user: { id: string; patId: string } | null;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer pns_')) {
      throw new UnauthorizedException('Token PAT manquant ou format invalide');
    }

    const token = authHeader.slice('Bearer '.length);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const pat = await this.patRepository.findByHash(tokenHash);

    if (!pat) {
      throw new UnauthorizedException('Token PAT invalide');
    }

    if (pat.revokedAt !== null) {
      throw new UnauthorizedException('Token PAT révoqué');
    }

    if (pat.expiresAt <= new Date()) {
      throw new UnauthorizedException('Token PAT expiré');
    }

    const requiredScopes = this.reflector.get<string[]>(
      SCOPES_KEY,
      context.getHandler(),
    );

    if (requiredScopes && requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every((s) => pat.scopes.includes(s));
      if (!hasAllScopes) {
        throw new ForbiddenException(
          `Scopes insuffisants. Requis : ${requiredScopes.join(', ')}`,
        );
      }
    }

    // Fire-and-forget : mise à jour last_used_at sans bloquer la requête
    void this.patRepository
      .update({ ...pat, lastUsedAt: new Date() })
      .catch(() => {
        // Silencieux — non bloquant
      });

    request.user = { id: pat.userId, patId: pat.id };

    TraceContext.enrichPatContext(pat.id, pat.userId);

    return true;
  }
}
