/**
 * ICacheClient — Interface générique de cache key/value
 *
 * ADR-027: Pattern de cache unitaire opt-in via CacheableRepository.
 * Implémentations : RedisCacheClient (production), InMemoryCacheClient (tests).
 */
export interface ICacheClient {
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set<T>(key: string, value: T): Promise<void>;
  mset<T>(entries: { key: string; value: T }[]): Promise<void>;
  del(key: string): Promise<void>;
}
