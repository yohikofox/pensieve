/**
 * Tests unitaires — PATGuard
 * Story 27.1: PAT Backend — Subtask 3.6
 *
 * Couvre :
 * - Token valide → canActivate true + request.user enrichi (AC7)
 * - Token révoqué → UnauthorizedException (AC6 guard, AC7)
 * - Token expiré → UnauthorizedException (AC7)
 * - Header manquant/mauvais format → UnauthorizedException
 * - Token introuvable en base → UnauthorizedException
 * - Scopes suffisants → canActivate true (AC8 positive)
 * - Scopes insuffisants → ForbiddenException (AC8 negative)
 * - TraceContext enrichi avec patId/userId (AC10)
 */

import * as crypto from 'crypto';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatGuard } from './pat.guard';
import { PatRepository } from '../repositories/pat.repository';
import { PersonalAccessToken } from '../../domain/entities/personal-access-token.entity';
import { TraceContext } from '../../../../common/trace/trace.context';
import { SCOPES_KEY } from './require-scopes.decorator';

const makePat = (
  overrides: Partial<PersonalAccessToken> = {},
): PersonalAccessToken => {
  const pat = new PersonalAccessToken();
  pat.id = 'pat-guard-id';
  pat.userId = 'user-guard-id';
  pat.name = 'PAT Guard Test';
  pat.tokenHash = 'will-be-overridden';
  pat.prefix = 'pns_abcd1234';
  pat.scopes = ['captures:read'];
  pat.expiresAt = new Date(Date.now() + 86400_000);
  pat.lastUsedAt = null;
  pat.revokedAt = null;
  pat.createdAt = new Date();
  return Object.assign(pat, overrides);
};

/** Crée un ExecutionContext minimal simulant une requête HTTP */
const makeContext = (
  authHeader?: string,
  handlerScopes?: string[],
  mockReflector?: jest.Mocked<Reflector>,
): ExecutionContext => {
  const request: {
    headers: Record<string, string>;
    user: null | { id: string; patId: string };
  } = {
    headers: authHeader ? { authorization: authHeader } : {},
    user: null,
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    getType: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
};

describe('PATGuard', () => {
  let guard: PatGuard;
  let mockRepo: jest.Mocked<PatRepository>;
  let mockReflector: jest.Mocked<Reflector>;
  let validToken: string;
  let validHash: string;

  beforeEach(() => {
    validToken = `pns_${crypto.randomBytes(32).toString('base64url')}`;
    validHash = crypto.createHash('sha256').update(validToken).digest('hex');

    mockRepo = {
      save: jest.fn(),
      findByHash: jest.fn(),
      findByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PatRepository>;

    mockReflector = {
      get: jest.fn().mockReturnValue(undefined), // pas de scopes par défaut
    } as unknown as jest.Mocked<Reflector>;

    guard = new PatGuard(mockRepo, mockReflector);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cas d'erreur — header manquant ou mauvais format
  // ───────────────────────────────────────────────────────────────────────────

  describe('header manquant ou format invalide', () => {
    it('lève UnauthorizedException si header Authorization absent', async () => {
      const ctx = makeContext(undefined);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lève UnauthorizedException si Bearer sans pns_', async () => {
      const ctx = makeContext('Bearer regular-jwt-token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lève UnauthorizedException si header non Bearer', async () => {
      const ctx = makeContext('Token pns_something');
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC7 — Token valide
  // ───────────────────────────────────────────────────────────────────────────

  describe('AC7 — token valide', () => {
    it('retourne true si token valide (non révoqué, non expiré)', async () => {
      const pat = makePat({ tokenHash: validHash });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);

      const ctx = makeContext(`Bearer ${validToken}`);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('enrichit request.user avec id et patId', async () => {
      const pat = makePat({ tokenHash: validHash });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);

      const request = {
        headers: { authorization: `Bearer ${validToken}` },
        user: null,
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(ctx);

      expect(request.user).toEqual({ id: pat.userId, patId: pat.id });
    });

    it('lève UnauthorizedException si token non trouvé en base', async () => {
      mockRepo.findByHash.mockResolvedValue(null);

      const ctx = makeContext(`Bearer ${validToken}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('hashage SHA-256 du token avant recherche en base', async () => {
      mockRepo.findByHash.mockResolvedValue(null);

      const ctx = makeContext(`Bearer ${validToken}`);
      await guard.canActivate(ctx).catch(() => {});

      expect(mockRepo.findByHash).toHaveBeenCalledWith(validHash);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC6 (guard) / AC7 — Token révoqué ou expiré
  // ───────────────────────────────────────────────────────────────────────────

  describe('AC6/AC7 — token révoqué ou expiré', () => {
    it('AC6 — lève UnauthorizedException si PAT révoqué', async () => {
      const pat = makePat({
        tokenHash: validHash,
        revokedAt: new Date('2026-01-01'),
      });
      mockRepo.findByHash.mockResolvedValue(pat);

      const ctx = makeContext(`Bearer ${validToken}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('AC7 — lève UnauthorizedException si PAT expiré', async () => {
      const pat = makePat({
        tokenHash: validHash,
        expiresAt: new Date(Date.now() - 86400_000), // expiré hier
      });
      mockRepo.findByHash.mockResolvedValue(pat);

      const ctx = makeContext(`Bearer ${validToken}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC8 — Vérification des scopes
  // ───────────────────────────────────────────────────────────────────────────

  describe('AC8 — vérification des scopes', () => {
    it('AC8 positive — PAT avec les scopes requis → canActivate true', async () => {
      const pat = makePat({
        tokenHash: validHash,
        scopes: ['captures:read', 'todos:write'],
      });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);
      mockReflector.get.mockReturnValue(['captures:read']);

      const ctx = makeContext(`Bearer ${validToken}`);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('AC8 negative — PAT sans les scopes requis → ForbiddenException', async () => {
      const pat = makePat({
        tokenHash: validHash,
        scopes: ['captures:read'],
      });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockReflector.get.mockReturnValue(['todos:write']);

      const ctx = makeContext(`Bearer ${validToken}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('AC8 — pas de @RequireScopes → pas de vérification de scope', async () => {
      const pat = makePat({ tokenHash: validHash, scopes: [] });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);
      mockReflector.get.mockReturnValue(undefined);

      const ctx = makeContext(`Bearer ${validToken}`);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC10 — TraceContext enrichi avec patId/userId
  // ───────────────────────────────────────────────────────────────────────────

  describe('AC10 — enrichissement TraceContext', () => {
    it('enrichit TraceContext avec patId et userId si store actif', async () => {
      const pat = makePat({
        tokenHash: validHash,
        id: 'pat-trace-id',
        userId: 'user-trace-id',
      });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);

      await TraceContext.run(
        { traceId: 'trace-test', source: 'http' },
        async () => {
          const ctx = makeContext(`Bearer ${validToken}`);
          await guard.canActivate(ctx);

          expect(TraceContext.getPatId()).toBe('pat-trace-id');
          expect(TraceContext.getUserId()).toBe('user-trace-id');
        },
      );
    });

    it("ne bloque pas la requête si le store TraceContext n'est pas initialisé", async () => {
      const pat = makePat({ tokenHash: validHash });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);

      // Hors d'un TraceContext.run() — enrichPatContext doit juste logger un warning
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const ctx = makeContext(`Bearer ${validToken}`);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true); // la requête passe quand même
      consoleSpy.mockRestore();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // last_used_at — fire-and-forget
  // ───────────────────────────────────────────────────────────────────────────

  describe('last_used_at fire-and-forget', () => {
    it('met à jour last_used_at sans bloquer la requête', async () => {
      const pat = makePat({ tokenHash: validHash });
      mockRepo.findByHash.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(pat);

      const ctx = makeContext(`Bearer ${validToken}`);
      await guard.canActivate(ctx);

      // Le update est appelé en fire-and-forget (on ne peut pas garantir le timing,
      // mais on vérifie qu'il est bien planifié)
      await Promise.resolve(); // flush microtasks
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });
  });
});
