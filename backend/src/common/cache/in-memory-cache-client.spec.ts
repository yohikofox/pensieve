/**
 * Tests unitaires — InMemoryCacheClient
 *
 * ADR-027: Implémentation mémoire de ICacheClient pour les tests.
 *
 * Vérifie :
 * - get/set : stockage et récupération d'une valeur
 * - get : retourne null pour une clé inexistante
 * - mget : récupération multiple avec gestion des clés manquantes
 * - mset : stockage multiple
 * - del : suppression d'une entrée
 * - Sérialisation JSON : les objets complexes sont correctement (dé)sérialisés
 */

import { InMemoryCacheClient } from './in-memory-cache-client';

describe('InMemoryCacheClient', () => {
  let cache: InMemoryCacheClient;

  beforeEach(() => {
    cache = new InMemoryCacheClient();
  });

  // ---------------------------------------------------------------------------
  // get / set
  // ---------------------------------------------------------------------------
  describe('get / set', () => {
    it('retourne null pour une clé inexistante', async () => {
      const result = await cache.get<string>('inexistant');
      expect(result).toBeNull();
    });

    it('retourne la valeur après un set', async () => {
      await cache.set('key-1', 'hello');
      const result = await cache.get<string>('key-1');
      expect(result).toBe('hello');
    });

    it('sérialise et désérialise un objet complexe', async () => {
      const obj = { id: 'abc', name: 'audio', isActive: true };
      await cache.set('key-obj', obj);
      const result = await cache.get<typeof obj>('key-obj');
      expect(result).toEqual(obj);
    });

    it('écrase la valeur existante lors d\'un second set', async () => {
      await cache.set('key-overwrite', 'v1');
      await cache.set('key-overwrite', 'v2');
      const result = await cache.get<string>('key-overwrite');
      expect(result).toBe('v2');
    });
  });

  // ---------------------------------------------------------------------------
  // mget / mset
  // ---------------------------------------------------------------------------
  describe('mget / mset', () => {
    it('retourne toutes les valeurs dans l\'ordre des clés', async () => {
      await cache.mset([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
      ]);

      const results = await cache.mget<number>(['c', 'a', 'b']);
      expect(results).toEqual([3, 1, 2]);
    });

    it('retourne null pour les clés manquantes dans mget', async () => {
      await cache.set('exists', 'valeur');
      const results = await cache.mget<string>(['exists', 'manquant']);
      expect(results).toEqual(['valeur', null]);
    });

    it('retourne un tableau vide pour mget avec liste vide', async () => {
      const results = await cache.mget([]);
      expect(results).toEqual([]);
    });

    it('ne fait rien pour mset avec liste vide', async () => {
      await expect(cache.mset([])).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // del
  // ---------------------------------------------------------------------------
  describe('del', () => {
    it('supprime une clé existante', async () => {
      await cache.set('a-supprimer', 'valeur');
      await cache.del('a-supprimer');
      const result = await cache.get('a-supprimer');
      expect(result).toBeNull();
    });

    it('ne lève pas d\'erreur si la clé n\'existe pas', async () => {
      await expect(cache.del('inexistante')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // clear (utilitaire de test)
  // ---------------------------------------------------------------------------
  describe('clear', () => {
    it('vide toutes les entrées du cache', async () => {
      await cache.set('k1', 'v1');
      await cache.set('k2', 'v2');
      cache.clear();
      expect(await cache.get('k1')).toBeNull();
      expect(await cache.get('k2')).toBeNull();
    });
  });
});
