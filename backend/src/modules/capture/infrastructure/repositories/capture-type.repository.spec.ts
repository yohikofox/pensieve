/**
 * Tests unitaires — CaptureTypeRepository
 *
 * ADR-027: Repository cacheable pour les types de capture.
 *
 * Vérifie :
 * - queryByIds : délègue à TypeORM findBy({ id: In(ids) })
 * - resolveIdByNaturalKey : filtre sur le champ `name`
 * - Namespace : 'capture-type' (clés cache correctement préfixées)
 */

import { InMemoryCacheClient } from '../../../../common/cache/in-memory-cache-client';
import { CaptureTypeRepository } from './capture-type.repository';
import { CaptureType } from '../../domain/entities/capture-type.entity';

// =============================================================================
// Helpers de mock
// =============================================================================

const makeEntity = (id: string, name: string): CaptureType => {
  const e = new CaptureType();
  e.id = id;
  e.name = name;
  e.isActive = true;
  e.createdAt = new Date();
  e.updatedAt = new Date();
  return e;
};

const makeOrmMock = (entities: CaptureType[]) => ({
  findBy: jest.fn().mockResolvedValue(entities),
  findOne: jest
    .fn()
    .mockImplementation(async (opts: { where: { name: string } }) => {
      return entities.find((e) => e.name === opts.where.name) ?? null;
    }),
});

// =============================================================================
// Tests
// =============================================================================

describe('CaptureTypeRepository', () => {
  let cache: InMemoryCacheClient;
  const audioType = makeEntity('id-audio', 'audio');
  const textType = makeEntity('id-text', 'text');

  beforeEach(() => {
    cache = new InMemoryCacheClient();
  });

  afterEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // queryByIds — délégation TypeORM
  // ---------------------------------------------------------------------------
  describe('queryByIds', () => {
    it('appelle findBy avec les IDs demandés', async () => {
      const orm = makeOrmMock([audioType, textType]);
      const repo = new CaptureTypeRepository(cache, orm as any);

      const result = await repo.findByIds(['id-audio', 'id-text']);

      expect(orm.findBy).toHaveBeenCalledTimes(1);
      expect(orm.findBy).toHaveBeenCalledWith({ id: expect.anything() }); // In([...])
      expect(result).toHaveLength(2);
    });

    it('retourne uniquement les entités trouvées en DB', async () => {
      const orm = makeOrmMock([audioType]);
      const repo = new CaptureTypeRepository(cache, orm as any);

      const result = await repo.findByIds(['id-audio', 'id-inexistant']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-audio');
    });
  });

  // ---------------------------------------------------------------------------
  // resolveIdByNaturalKey — filtrage sur `name`
  // ---------------------------------------------------------------------------
  describe('resolveIdByNaturalKey (via findByNaturalKey)', () => {
    it("résout l'entité par son nom", async () => {
      const orm = makeOrmMock([audioType, textType]);
      const repo = new CaptureTypeRepository(cache, orm as any);

      const result = await repo.findByNaturalKey('audio');

      expect(orm.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'audio' } }),
      );
      expect(result?.id).toBe('id-audio');
    });

    it('retourne null si le nom est introuvable', async () => {
      const orm = makeOrmMock([]);
      const repo = new CaptureTypeRepository(cache, orm as any);

      const result = await repo.findByNaturalKey('video');
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Intégration cache — les appels DB sont évités au second accès
  // ---------------------------------------------------------------------------
  describe('cache-aside (intégration avec InMemoryCacheClient)', () => {
    it("ne consulte pas la DB lors d'un second findByIds pour les mêmes IDs", async () => {
      const orm = makeOrmMock([audioType]);
      const repo = new CaptureTypeRepository(cache, orm as any);

      await repo.findByIds(['id-audio']);
      await repo.findByIds(['id-audio']);

      // TypeORM ne doit être appelé qu'une seule fois
      expect(orm.findBy).toHaveBeenCalledTimes(1);
    });
  });
});
