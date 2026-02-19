/**
 * Tests unitaires — ThoughtStatusRepository
 *
 * ADR-027: Repository cacheable pour les statuts de thought.
 *
 * Vérifie :
 * - resolveIdByNaturalKey : filtre sur `code` (différent des repositories capture qui filtrent sur `name`)
 * - queryByIds : délègue à TypeORM findBy({ id: In(ids) })
 */

import { InMemoryCacheClient } from '../../../../common/cache/in-memory-cache-client';
import { ThoughtStatusRepository } from './thought-status.repository';
import { ThoughtStatus } from '../../domain/entities/thought-status.entity';

// =============================================================================
// Helpers de mock
// =============================================================================

const makeEntity = (id: string, code: string): ThoughtStatus => {
  const e = new ThoughtStatus();
  e.id = id;
  e.code = code;
  e.label = code;
  e.displayOrder = 0;
  e.isActive = true;
  e.createdAt = new Date();
  e.updatedAt = new Date();
  return e;
};

const makeOrmMock = (entities: ThoughtStatus[]) => ({
  findBy: jest.fn().mockResolvedValue(entities),
  findOne: jest
    .fn()
    .mockImplementation(async (opts: { where: { code: string } }) => {
      return entities.find((e) => e.code === opts.where.code) ?? null;
    }),
});

// =============================================================================
// Tests
// =============================================================================

describe('ThoughtStatusRepository', () => {
  let cache: InMemoryCacheClient;
  const activeStatus = makeEntity('id-active', 'active');
  const archivedStatus = makeEntity('id-archived', 'archived');

  beforeEach(() => {
    cache = new InMemoryCacheClient();
  });

  afterEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // queryByIds
  // ---------------------------------------------------------------------------
  describe('queryByIds', () => {
    it('retourne les entités correspondant aux IDs', async () => {
      const orm = makeOrmMock([activeStatus, archivedStatus]);
      const repo = new ThoughtStatusRepository(cache, orm as any);

      const result = await repo.findByIds(['id-active', 'id-archived']);
      expect(result).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // resolveIdByNaturalKey — filtre sur `code` (pas `name`)
  // ---------------------------------------------------------------------------
  describe('resolveIdByNaturalKey — filtre sur code', () => {
    it("résout l'entité par son code", async () => {
      const orm = makeOrmMock([activeStatus, archivedStatus]);
      const repo = new ThoughtStatusRepository(cache, orm as any);

      const result = await repo.findByNaturalKey('active');

      expect(orm.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'active' } }),
      );
      expect(result?.id).toBe('id-active');
    });

    it('utilise le champ `code` et non `name`', async () => {
      const orm = makeOrmMock([activeStatus]);
      const repo = new ThoughtStatusRepository(cache, orm as any);

      await repo.findByNaturalKey('active');

      const callArgs = orm.findOne.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where).toHaveProperty('code');
      expect(callArgs.where).not.toHaveProperty('name');
    });

    it('retourne null pour un code inexistant', async () => {
      const orm = makeOrmMock([]);
      const repo = new ThoughtStatusRepository(cache, orm as any);

      const result = await repo.findByNaturalKey('deleted');
      expect(result).toBeNull();
    });
  });
});
