/**
 * ThoughtDeleteService — Tests unitaires
 *
 * Story 12.4: Supprimer les Cascades TypeORM — ADR-026 R3
 *
 * Valide :
 * - AC2 : Soft-delete des Ideas liées avec log structuré
 * - AC3 : Transaction atomique avec rollback sur échec
 * - Result Pattern : Pas de throw, retour Result<void>
 */

import { Logger } from '@nestjs/common';
import { ThoughtDeleteService } from './thought-delete.service';
import { isSuccess, isError } from '../../../../common/types/result.type';

// =============================================================================
// Helpers de mock DataSource
// =============================================================================

interface TransactionCallbacks {
  softDeleteCalls: Array<{ entity: string; ids: string | string[] }>;
  findCalls: Array<{ entity: string; options: any }>;
  shouldFailOnIdeaSoftDelete: boolean;
  shouldFailOnThoughtSoftDelete: boolean;
}

const createMockDataSource = (opts: Partial<TransactionCallbacks> = {}) => {
  const callbacks: TransactionCallbacks = {
    softDeleteCalls: [],
    findCalls: [],
    shouldFailOnIdeaSoftDelete: false,
    shouldFailOnThoughtSoftDelete: false,
    ...opts,
  };

  const ideaRepo = {
    find: jest.fn().mockImplementation(async (options: any) => {
      callbacks.findCalls.push({ entity: 'Idea', options });
      return [
        { id: 'idea-001', thoughtId: options?.where?.thoughtId },
        { id: 'idea-002', thoughtId: options?.where?.thoughtId },
      ];
    }),
    softDelete: jest.fn().mockImplementation(async (ids: string[]) => {
      if (callbacks.shouldFailOnIdeaSoftDelete) {
        throw new Error('Idea soft-delete failed');
      }
      callbacks.softDeleteCalls.push({ entity: 'Idea', ids });
      return { affected: ids.length };
    }),
  };

  const thoughtRepo = {
    softDelete: jest.fn().mockImplementation(async (id: string) => {
      if (callbacks.shouldFailOnThoughtSoftDelete) {
        throw new Error('Thought soft-delete failed');
      }
      callbacks.softDeleteCalls.push({ entity: 'Thought', ids: id });
      return { affected: 1 };
    }),
  };

  let transactionRolledBack = false;

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => {
      const manager = {
        getRepository: jest.fn().mockImplementation((EntityClass: any) => {
          if (EntityClass.name === 'Idea') return ideaRepo;
          if (EntityClass.name === 'Thought') return thoughtRepo;
          throw new Error(`Unknown entity: ${EntityClass.name}`);
        }),
      };
      try {
        return await fn(manager);
      } catch (error) {
        transactionRolledBack = true;
        throw error;
      }
    }),
    _wasRolledBack: () => transactionRolledBack,
    _ideaRepo: ideaRepo,
    _thoughtRepo: thoughtRepo,
    _callbacks: callbacks,
  };

  return dataSource;
};

// =============================================================================
// Tests
// =============================================================================

describe('ThoughtDeleteService', () => {
  let service: ThoughtDeleteService;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC2: Cascade applicative — soft-delete des Ideas liées
  // ---------------------------------------------------------------------------
  describe('softDeleteWithRelated — cascade applicative', () => {
    it('soft-delete les Ideas liées avant de supprimer le Thought', async () => {
      const dataSource = createMockDataSource();
      service = new ThoughtDeleteService(dataSource as any);

      const result = await service.softDeleteWithRelated('thought-001');

      // Vérifie succès
      expect(isSuccess(result)).toBe(true);

      // Vérifie que les Ideas ont été cherchées
      expect(dataSource._ideaRepo.find).toHaveBeenCalledWith({
        where: { thoughtId: 'thought-001' },
      });

      // Vérifie soft-delete des Ideas
      const ideaDeleteCall = dataSource._callbacks.softDeleteCalls.find(
        (c) => c.entity === 'Idea',
      );
      expect(ideaDeleteCall).toBeDefined();
      expect(ideaDeleteCall!.ids).toContain('idea-001');
      expect(ideaDeleteCall!.ids).toContain('idea-002');

      // Vérifie soft-delete du Thought
      const thoughtDeleteCall = dataSource._callbacks.softDeleteCalls.find(
        (c) => c.entity === 'Thought',
      );
      expect(thoughtDeleteCall).toBeDefined();
      expect(thoughtDeleteCall!.ids).toBe('thought-001');

      // AC2 : Vérifie log structuré avec reason (obligatoire par l'AC)
      expect(logSpy).toHaveBeenCalledWith(
        'thought.ideas.soft-deleted',
        expect.objectContaining({
          thoughtId: 'thought-001',
          reason: 'thought.deletion.cascade',
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'thought.soft-deleted',
        expect.objectContaining({
          thoughtId: 'thought-001',
          reason: 'explicit.application.delete',
        }),
      );
    });

    it('soft-delete le Thought même si aucune Idea liée', async () => {
      const dataSource = createMockDataSource();
      // Override find pour retourner 0 ideas
      dataSource._ideaRepo.find.mockResolvedValue([]);
      service = new ThoughtDeleteService(dataSource as any);

      const result = await service.softDeleteWithRelated('thought-no-ideas');

      expect(isSuccess(result)).toBe(true);

      // Les Ideas ne sont pas appelées avec softDelete (aucune à supprimer)
      const ideaDeleteCall = dataSource._callbacks.softDeleteCalls.find(
        (c) => c.entity === 'Idea',
      );
      expect(ideaDeleteCall).toBeUndefined();

      // Le Thought est quand même supprimé
      const thoughtDeleteCall = dataSource._callbacks.softDeleteCalls.find(
        (c) => c.entity === 'Thought',
      );
      expect(thoughtDeleteCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // AC3: Transaction atomique — rollback sur échec
  // ---------------------------------------------------------------------------
  describe('softDeleteWithRelated — transaction atomique', () => {
    it("retourne transactionError si le soft-delete d'une Idea échoue", async () => {
      const dataSource = createMockDataSource({
        shouldFailOnIdeaSoftDelete: true,
      });
      service = new ThoughtDeleteService(dataSource as any);

      const result = await service.softDeleteWithRelated('thought-001');

      // Vérifie erreur retournée (pas de throw)
      expect(isError(result)).toBe(true);
      expect(result.type).toBe('transaction_error');
      expect(result.error).toBeDefined();

      // M2 : Vérifie que la transaction a bien rollback (atomicité)
      expect(dataSource._wasRolledBack()).toBe(true);

      // Vérifie que le Thought n'a pas été supprimé (rollback)
      const thoughtDeleteCall = dataSource._callbacks.softDeleteCalls.find(
        (c) => c.entity === 'Thought',
      );
      expect(thoughtDeleteCall).toBeUndefined();

      // Vérifie log d'erreur structuré
      expect(errorSpy).toHaveBeenCalledWith(
        'thought.delete.failed',
        expect.objectContaining({ thoughtId: 'thought-001' }),
      );
    });

    it('retourne transactionError si le soft-delete du Thought échoue', async () => {
      const dataSource = createMockDataSource({
        shouldFailOnThoughtSoftDelete: true,
      });
      service = new ThoughtDeleteService(dataSource as any);

      const result = await service.softDeleteWithRelated('thought-fail');

      expect(isError(result)).toBe(true);
      expect(result.type).toBe('transaction_error');
    });

    it('exécute les opérations dans une transaction', async () => {
      const dataSource = createMockDataSource();
      service = new ThoughtDeleteService(dataSource as any);

      await service.softDeleteWithRelated('thought-001');

      // Vérifie que DataSource.transaction() a été appelé
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Result Pattern — jamais de throw
  // ---------------------------------------------------------------------------
  describe('Result Pattern', () => {
    it("retourne un Result<void> de type success lors d'une suppression réussie", async () => {
      const dataSource = createMockDataSource();
      service = new ThoughtDeleteService(dataSource as any);

      const result = await service.softDeleteWithRelated('thought-ok');

      expect(result).toMatchObject({ type: 'success' });
      expect(result.error).toBeUndefined();
    });

    it("ne throw jamais, même en cas d'erreur interne", async () => {
      const dataSource = createMockDataSource({
        shouldFailOnIdeaSoftDelete: true,
      });
      service = new ThoughtDeleteService(dataSource as any);

      // La méthode NE DOIT PAS throw — elle retourne un Result
      await expect(
        service.softDeleteWithRelated('thought-error'),
      ).resolves.not.toThrow();

      const result = await service.softDeleteWithRelated('thought-error');
      expect(result.type).toBe('transaction_error');
    });
  });
});
