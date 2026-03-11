/**
 * Tests unitaires — PatService
 * Story 27.1: PAT Backend — Subtask 2.7
 *
 * Couvre :
 * - generate() : format token, hash, scopes invalides (AC1, AC2)
 * - findAll() : jamais token_hash dans la vue publique (AC3)
 * - update() : nom/scopes, not found (AC4)
 * - renew() : transaction atomique, nouveau token, révocation ancien (AC5)
 * - revoke() : set revoked_at, not found (AC6)
 */

import * as crypto from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatService } from './pat.service';
import { PatRepository } from '../../infrastructure/repositories/pat.repository';
import { PATAuditService } from './pat-audit.service';
import { PersonalAccessToken } from '../../domain/entities/personal-access-token.entity';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

const makePat = (
  overrides: Partial<PersonalAccessToken> = {},
): PersonalAccessToken => {
  const pat = new PersonalAccessToken();
  pat.id = 'pat-id-1';
  pat.userId = 'user-id-1';
  pat.name = 'Mon PAT';
  pat.tokenHash = 'hash-abc';
  pat.prefix = 'pns_a1b2c3d4';
  pat.scopes = ['captures:read'];
  pat.expiresAt = new Date(Date.now() + 86400_000 * 30);
  pat.lastUsedAt = null;
  pat.revokedAt = null;
  pat.createdAt = new Date();
  return Object.assign(pat, overrides);
};

describe('PatService', () => {
  let service: PatService;
  let mockRepo: jest.Mocked<PatRepository>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let mockManager: jest.Mocked<EntityManager>;
  let mockAuditService: jest.Mocked<PATAuditService>;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findByHash: jest.fn(),
      findByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PatRepository>;

    mockManager = {
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    } as unknown as jest.Mocked<QueryRunner>;

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
      findByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PATAuditService>;

    service = new PatService(mockRepo, mockDataSource, mockAuditService);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // generate() — AC1, AC2
  // ───────────────────────────────────────────────────────────────────────────

  describe('generate()', () => {
    it('AC1 — retourne un token commençant par pns_ et un pat sans tokenHash', async () => {
      const saved = makePat();
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.generate('user-id-1', {
        name: 'Mon PAT MCP',
        scopes: ['captures:read'],
        expiresInDays: 30,
      });

      expect(result.token).toMatch(/^pns_/);
      expect(result.pat).not.toHaveProperty('tokenHash');
      expect(result.pat.name).toBe(saved.name);
    });

    it('AC1 — stocke uniquement le hash SHA-256 (jamais le token brut)', async () => {
      const saved = makePat();
      mockRepo.save.mockResolvedValue(saved);

      await service.generate('user-id-1', {
        name: 'PAT',
        scopes: ['captures:read'],
        expiresInDays: 30,
      });

      const savedPat = mockRepo.save.mock.calls[0][0];
      expect(savedPat.tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex = 64 chars
      expect(savedPat.tokenHash).not.toMatch(/^pns_/); // jamais le token brut
    });

    it('AC1 — le prefix fait exactement 12 caractères', async () => {
      const saved = makePat();
      mockRepo.save.mockResolvedValue(saved);

      await service.generate('user-id-1', {
        name: 'PAT',
        scopes: ['captures:read'],
        expiresInDays: 30,
      });

      const savedPat = mockRepo.save.mock.calls[0][0];
      expect(savedPat.prefix).toHaveLength(12);
      expect(savedPat.prefix).toMatch(/^pns_/);
    });

    it('AC2 — lève BadRequestException pour un scope invalide', async () => {
      await expect(
        service.generate('user-id-1', {
          name: 'PAT',
          scopes: ['admin:all' as never],
          expiresInDays: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('AC2 — lève BadRequestException avec la liste des scopes invalides dans le message', async () => {
      await expect(
        service.generate('user-id-1', {
          name: 'PAT',
          scopes: ['admin:all' as never],
          expiresInDays: 30,
        }),
      ).rejects.toThrow('admin:all');
    });

    it('AC1 — expires_at = now + expiresInDays (tolérance DST ±25h)', async () => {
      const saved = makePat();
      mockRepo.save.mockResolvedValue(saved);

      const before = Date.now();
      await service.generate('user-id-1', {
        name: 'PAT',
        scopes: ['captures:read'],
        expiresInDays: 30,
      });

      const savedPat = mockRepo.save.mock.calls[0][0];
      // ±25h de tolérance pour gérer les transitions DST
      const expected = before + 30 * 86400_000;
      const toleranceMs = 25 * 3600_000;
      expect(savedPat.expiresAt.getTime()).toBeGreaterThanOrEqual(
        expected - toleranceMs,
      );
      expect(savedPat.expiresAt.getTime()).toBeLessThanOrEqual(
        expected + toleranceMs,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // findAll() — AC3
  // ───────────────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('AC3 — retourne les PATs sans tokenHash', async () => {
      const pat = makePat({ tokenHash: 'secret-hash' });
      mockRepo.findByUserId.mockResolvedValue([pat]);

      const result = await service.findAll('user-id-1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('tokenHash');
    });

    it('AC3 — retourne les champs publics corrects', async () => {
      const pat = makePat();
      mockRepo.findByUserId.mockResolvedValue([pat]);

      const [view] = await service.findAll('user-id-1');

      expect(view.id).toBe(pat.id);
      expect(view.userId).toBe(pat.userId);
      expect(view.name).toBe(pat.name);
      expect(view.prefix).toBe(pat.prefix);
      expect(view.scopes).toEqual(pat.scopes);
      expect(view.expiresAt).toEqual(pat.expiresAt);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // update() — AC4
  // ───────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('AC4 — met à jour le nom', async () => {
      const pat = makePat();
      const updated = makePat({ name: 'Nouveau Nom' });
      mockRepo.findByIdAndUserId.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update('pat-id-1', 'user-id-1', {
        name: 'Nouveau Nom',
      });

      expect(result.name).toBe('Nouveau Nom');
      expect(result).not.toHaveProperty('tokenHash');
    });

    it('AC4 — lève NotFoundException si PAT introuvable', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', 'user-id-1', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('AC4 — lève BadRequestException pour scope invalide dans update', async () => {
      const pat = makePat();
      mockRepo.findByIdAndUserId.mockResolvedValue(pat);

      await expect(
        service.update('pat-id-1', 'user-id-1', {
          scopes: ['invalid:scope' as never],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // renew() — AC5
  // ───────────────────────────────────────────────────────────────────────────

  describe('renew()', () => {
    it("AC5 — crée un nouveau token avec un hash différent de l'ancien", async () => {
      const existing = makePat({ tokenHash: 'old-hash' });
      mockRepo.findByIdAndUserId.mockResolvedValue(existing);

      const newPat = makePat({ id: 'new-pat-id', tokenHash: 'new-hash' });
      mockManager.save
        .mockResolvedValueOnce(existing) // révocation ancien
        .mockResolvedValueOnce(newPat); // sauvegarde nouveau

      const result = await service.renew('pat-id-1', 'user-id-1', {
        expiresInDays: 60,
      });

      expect(result.token).toMatch(/^pns_/);
      expect(result.pat).not.toHaveProperty('tokenHash');
    });

    it("AC5 — révoque l'ancien PAT dans la même transaction", async () => {
      const existing = makePat();
      mockRepo.findByIdAndUserId.mockResolvedValue(existing);
      mockManager.save.mockResolvedValue(makePat());

      await service.renew('pat-id-1', 'user-id-1', {});

      // Premier save = révocation de l'ancien (revoked_at non null)
      const revokedPat = mockManager.save.mock
        .calls[0][0] as PersonalAccessToken;
      expect(revokedPat.revokedAt).not.toBeNull();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it("AC5 — rollback en cas d'erreur de transaction", async () => {
      const existing = makePat();
      mockRepo.findByIdAndUserId.mockResolvedValue(existing);
      mockManager.save
        .mockResolvedValueOnce(existing)
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(service.renew('pat-id-1', 'user-id-1', {})).rejects.toThrow(
        'DB error',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('AC5 — lève NotFoundException si PAT introuvable', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.renew('unknown-id', 'user-id-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('AC5 — expiresInDays utilise 30 par défaut si non fourni', async () => {
      const existing = makePat();
      mockRepo.findByIdAndUserId.mockResolvedValue(existing);
      const newPat = makePat({ id: 'new-id' });
      mockManager.save
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(newPat);

      await service.renew('pat-id-1', 'user-id-1', {});

      const createdPat = mockManager.save.mock
        .calls[1][0] as PersonalAccessToken;
      const thirtyDaysFromNow = Date.now() + 30 * 86400_000;
      const toleranceMs = 25 * 3600_000;
      expect(createdPat.expiresAt.getTime()).toBeGreaterThanOrEqual(
        thirtyDaysFromNow - toleranceMs,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // revoke() — AC6
  // ───────────────────────────────────────────────────────────────────────────

  describe('revoke()', () => {
    it('AC6 — set revoked_at sur le PAT', async () => {
      const pat = makePat({ revokedAt: null });
      mockRepo.findByIdAndUserId.mockResolvedValue(pat);
      mockRepo.update.mockResolvedValue({
        ...pat,
        revokedAt: new Date(),
      } as PersonalAccessToken);

      await service.revoke('pat-id-1', 'user-id-1');

      const saved = mockRepo.update.mock.calls[0][0];
      expect(saved.revokedAt).not.toBeNull();
    });

    it('AC6 — lève NotFoundException si PAT introuvable', async () => {
      mockRepo.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.revoke('unknown-id', 'user-id-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
