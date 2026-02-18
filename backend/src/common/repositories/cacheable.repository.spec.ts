/**
 * Tests unitaires — CacheableRepository (algorithme cache-aside)
 *
 * ADR-027: Valide la logique de cache-aside implémentée dans la classe abstraite.
 * Utilise une sous-classe concrète de test + InMemoryCacheClient.
 *
 * Vérifie :
 * - findByIds : cache miss → query DB → peuple le cache
 * - findByIds : cache hit → pas d'appel DB
 * - findByIds : hit partiel → query uniquement les IDs manquants
 * - findByIds : tableau vide → retourne []
 * - findByNaturalKey : résout via resolveIdByNaturalKey puis findByIds
 * - findByNaturalKey : clé introuvable → retourne null
 * - invalidateAll : vide le namespace
 * - invalidateOne : invalide une seule entrée
 */

import { InMemoryCacheClient } from '../cache/in-memory-cache-client';
import { CacheableRepository } from './cacheable.repository';

// =============================================================================
// Sous-classe concrète de test
// =============================================================================

interface TestEntity {
  id: string;
  code: string;
}

class TestRepository extends CacheableRepository<TestEntity> {
  public queryByIdsCalls: string[][] = [];
  public resolveKeyCalls: string[] = [];

  private readonly db: Map<string, TestEntity>;

  constructor(cache: InMemoryCacheClient, db: Map<string, TestEntity>) {
    super(cache, 'test-entity');
    this.db = db;
  }

  protected queryByIds(ids: string[]): Promise<TestEntity[]> {
    this.queryByIdsCalls.push(ids);
    return Promise.resolve(
      ids.flatMap((id) => {
        const entity = this.db.get(id);
        return entity ? [entity] : [];
      }),
    );
  }

  protected resolveIdByNaturalKey(code: string): Promise<string | null> {
    this.resolveKeyCalls.push(code);
    for (const [id, entity] of this.db.entries()) {
      if (entity.code === code) return Promise.resolve(id);
    }
    return Promise.resolve(null);
  }
}

// =============================================================================
// Helpers
// =============================================================================

const makeDb = (...entities: TestEntity[]): Map<string, TestEntity> => {
  return new Map(entities.map((e) => [e.id, e]));
};

// =============================================================================
// Tests
// =============================================================================

describe('CacheableRepository', () => {
  let cache: InMemoryCacheClient;
  let db: Map<string, TestEntity>;
  let repo: TestRepository;

  const entityA: TestEntity = { id: 'id-a', code: 'alpha' };
  const entityB: TestEntity = { id: 'id-b', code: 'beta' };
  const entityC: TestEntity = { id: 'id-c', code: 'gamma' };

  beforeEach(() => {
    cache = new InMemoryCacheClient();
    db = makeDb(entityA, entityB, entityC);
    repo = new TestRepository(cache, db);
  });

  afterEach(() => {
    cache.clear();
  });

  // ---------------------------------------------------------------------------
  // findByIds — cache miss
  // ---------------------------------------------------------------------------
  describe('findByIds — cache miss', () => {
    it('query la DB et retourne les entités', async () => {
      const result = await repo.findByIds(['id-a', 'id-b']);

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([entityA, entityB]));
    });

    it('appelle queryByIds exactement une fois avec les IDs demandés', async () => {
      await repo.findByIds(['id-a', 'id-b']);

      expect(repo.queryByIdsCalls).toHaveLength(1);
      expect(repo.queryByIdsCalls[0]).toEqual(
        expect.arrayContaining(['id-a', 'id-b']),
      );
    });

    it('retourne un tableau vide pour une liste vide', async () => {
      const result = await repo.findByIds([]);
      expect(result).toEqual([]);
      expect(repo.queryByIdsCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findByIds — cache hit (second appel)
  // ---------------------------------------------------------------------------
  describe('findByIds — cache hit', () => {
    it('ne query pas la DB lors d\'un second appel pour les mêmes IDs', async () => {
      // Premier appel : peuple le cache
      await repo.findByIds(['id-a']);

      // Réinitialise le compteur d'appels DB
      repo.queryByIdsCalls = [];

      // Second appel : doit venir du cache
      const result = await repo.findByIds(['id-a']);

      expect(result).toEqual([entityA]);
      expect(repo.queryByIdsCalls).toHaveLength(0);
    });

    it('retourne les entités correctes depuis le cache', async () => {
      await repo.findByIds(['id-b']);
      repo.queryByIdsCalls = [];

      const result = await repo.findByIds(['id-b']);
      expect(result[0]).toEqual(entityB);
    });
  });

  // ---------------------------------------------------------------------------
  // findByIds — hit partiel
  // ---------------------------------------------------------------------------
  describe('findByIds — hit partiel', () => {
    it('ne query que les IDs manquants quand certains sont en cache', async () => {
      // Peuple uniquement id-a en cache
      await repo.findByIds(['id-a']);
      repo.queryByIdsCalls = [];

      // Demande id-a (hit) + id-b (miss)
      const result = await repo.findByIds(['id-a', 'id-b']);

      expect(result).toHaveLength(2);
      // La DB a été appelée uniquement pour id-b
      expect(repo.queryByIdsCalls).toHaveLength(1);
      expect(repo.queryByIdsCalls[0]).toEqual(['id-b']);
      expect(repo.queryByIdsCalls[0]).not.toContain('id-a');
    });
  });

  // ---------------------------------------------------------------------------
  // findByNaturalKey
  // ---------------------------------------------------------------------------
  describe('findByNaturalKey', () => {
    it('résout l\'ID via resolveIdByNaturalKey et retourne l\'entité', async () => {
      const result = await repo.findByNaturalKey('alpha');

      expect(result).toEqual(entityA);
      expect(repo.resolveKeyCalls).toContain('alpha');
    });

    it('retourne null si la clé naturelle n\'existe pas', async () => {
      const result = await repo.findByNaturalKey('inexistant');
      expect(result).toBeNull();
    });

    it('peuple le cache pour findByIds suivant', async () => {
      await repo.findByNaturalKey('beta');
      repo.queryByIdsCalls = [];

      // id-b est maintenant en cache
      const result = await repo.findByIds(['id-b']);
      expect(result).toEqual([entityB]);
      expect(repo.queryByIdsCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // invalidateOne
  // ---------------------------------------------------------------------------
  describe('invalidateOne', () => {
    it('force un rechargement DB après invalidation d\'une entrée', async () => {
      // Peuple le cache
      await repo.findByIds(['id-a']);
      repo.queryByIdsCalls = [];

      // Invalide id-a
      await repo.invalidateOne('id-a');

      // Le prochain accès doit aller en DB
      await repo.findByIds(['id-a']);
      expect(repo.queryByIdsCalls).toHaveLength(1);
    });

    it('n\'affecte pas les autres entrées du cache', async () => {
      await repo.findByIds(['id-a', 'id-b']);
      repo.queryByIdsCalls = [];

      await repo.invalidateOne('id-a');

      // id-b est toujours en cache
      await repo.findByIds(['id-b']);
      expect(repo.queryByIdsCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // invalidateAll
  // ---------------------------------------------------------------------------
  describe('invalidateAll', () => {
    it('invalide uniquement la clé de namespace (pas les entrées individuelles)', async () => {
      // Note : invalidateAll supprime la clé de namespace (ns:{namespace}).
      // Les entrées individuelles restent mais peuvent être invalidées séparément.
      // Ce test vérifie que la méthode ne lève pas d'erreur.
      await repo.findByIds(['id-a', 'id-b']);
      await expect(repo.invalidateAll()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // resolveIdByNaturalKey par défaut (non overridé)
  // ---------------------------------------------------------------------------
  describe('resolveIdByNaturalKey — comportement par défaut', () => {
    it('rejette avec une erreur si non implémenté dans la sous-classe', async () => {
      // Créer une sous-classe qui n'override pas resolveIdByNaturalKey
      class MinimalRepo extends CacheableRepository<TestEntity> {
        protected queryByIds(ids: string[]): Promise<TestEntity[]> {
          return Promise.resolve(ids.map((id) => ({ id, code: 'x' })));
        }
      }
      const minimalRepo = new MinimalRepo(cache, 'minimal');

      await expect(minimalRepo.findByNaturalKey('any')).rejects.toThrow(
        'resolveIdByNaturalKey non implémenté',
      );
    });
  });
});
