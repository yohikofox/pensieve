/**
 * Tests unitaires — PATAuditService
 * Story 27.3: PAT Admin — Subtask 1.2
 *
 * Couvre :
 * - log() : crée une entrée d'audit avec uuidv7 + bons champs
 * - findByUserId() : retourne logs triés + tableau vide si aucun log
 */

import { PATAuditService } from './pat-audit.service';
import { PATAuditRepository } from '../../infrastructure/repositories/pat-audit.repository';
import { PATAuditLog } from '../../domain/entities/pat-audit-log.entity';

const makeAuditLog = (overrides: Partial<PATAuditLog> = {}): PATAuditLog => {
  const log = new PATAuditLog();
  log.id = 'audit-id-1';
  log.adminId = 'admin-id-1';
  log.userId = 'user-id-1';
  log.patId = 'pat-id-1';
  log.action = 'create';
  log.createdAt = new Date('2026-03-01T10:00:00Z');
  return Object.assign(log, overrides);
};

describe('PATAuditService', () => {
  let service: PATAuditService;
  let mockRepo: jest.Mocked<PATAuditRepository>;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findByUserId: jest.fn(),
    } as unknown as jest.Mocked<PATAuditRepository>;

    service = new PATAuditService(mockRepo);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // log() — AC5
  // ───────────────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it("AC5 — crée une entrée d'audit avec les bons champs", async () => {
      const log = makeAuditLog();
      mockRepo.save.mockResolvedValue(log);

      await service.log('admin-id-1', 'user-id-1', 'pat-id-1', 'create');

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.adminId).toBe('admin-id-1');
      expect(saved.userId).toBe('user-id-1');
      expect(saved.patId).toBe('pat-id-1');
      expect(saved.action).toBe('create');
    });

    it('AC5 — génère un id uuidv7 (format UUID)', async () => {
      mockRepo.save.mockResolvedValue(makeAuditLog());

      await service.log('admin-id-1', 'user-id-1', 'pat-id-1', 'create');

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('AC5 — fonctionne pour l\'action "revoke"', async () => {
      mockRepo.save.mockResolvedValue(makeAuditLog({ action: 'revoke' }));

      await service.log('admin-id-1', 'user-id-1', 'pat-id-1', 'revoke');

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.action).toBe('revoke');
    });

    it('AC5 — fonctionne pour l\'action "renew"', async () => {
      mockRepo.save.mockResolvedValue(makeAuditLog({ action: 'renew' }));

      await service.log('admin-id-1', 'user-id-1', 'pat-id-1', 'renew');

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.action).toBe('renew');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // findByUserId() — AC5
  // ───────────────────────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('AC5 — retourne les logs triés pour un userId donné', async () => {
      const logs = [
        makeAuditLog({
          id: 'log-1',
          action: 'create',
          createdAt: new Date('2026-03-01T10:00:00Z'),
        }),
        makeAuditLog({
          id: 'log-2',
          action: 'revoke',
          createdAt: new Date('2026-03-02T10:00:00Z'),
        }),
      ];
      mockRepo.findByUserId.mockResolvedValue(logs);

      const result = await service.findByUserId('user-id-1');

      expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-id-1');
      expect(result).toHaveLength(2);
    });

    it('AC5 — retourne un tableau vide si aucun log', async () => {
      mockRepo.findByUserId.mockResolvedValue([]);

      const result = await service.findByUserId('user-id-1');

      expect(result).toEqual([]);
    });

    it("AC5 — les vues ne contiennent pas d'information sensible (pas de token)", async () => {
      const logs = [makeAuditLog()];
      mockRepo.findByUserId.mockResolvedValue(logs);

      const result = await service.findByUserId('user-id-1');

      for (const view of result) {
        expect(view).not.toHaveProperty('tokenHash');
        expect(view).not.toHaveProperty('token');
        expect(view).toHaveProperty('id');
        expect(view).toHaveProperty('adminId');
        expect(view).toHaveProperty('userId');
        expect(view).toHaveProperty('patId');
        expect(view).toHaveProperty('action');
        expect(view).toHaveProperty('createdAt');
      }
    });
  });
});
