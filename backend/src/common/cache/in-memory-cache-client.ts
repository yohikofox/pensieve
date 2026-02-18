/**
 * InMemoryCacheClient — Implémentation en mémoire de ICacheClient
 *
 * ADR-027: Implémentation pour les tests et l'environnement de développement
 * sans Redis. Utilise un Map<string, string> avec sérialisation JSON.
 */

import type { ICacheClient } from './i-cache-client.interface';

export class InMemoryCacheClient implements ICacheClient {
  private readonly store = new Map<string, string>();

  get<T>(key: string): Promise<T | null> {
    const data = this.store.get(key);
    const result = data === undefined ? null : (JSON.parse(data) as T);
    return Promise.resolve(result);
  }

  mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results = keys.map((key) => {
      const data = this.store.get(key);
      return data === undefined ? null : (JSON.parse(data) as T);
    });
    return Promise.resolve(results);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value));
    return Promise.resolve();
  }

  mset<T>(entries: { key: string; value: T }[]): Promise<void> {
    for (const { key, value } of entries) {
      this.store.set(key, JSON.stringify(value));
    }
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  /** Utilitaire de test : vide le cache */
  clear(): void {
    this.store.clear();
  }
}
