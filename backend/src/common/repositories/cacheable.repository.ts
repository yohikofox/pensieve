/**
 * CacheableRepository<T> — Classe abstraite pour les repositories avec cache
 *
 * ADR-027: Pattern de cache unitaire opt-in pour les données référentielles.
 *
 * Algorithme :
 * 1. findByIds(ids) → vérifie le cache, ne query que les IDs manquants, peuple le cache
 * 2. findByNaturalKey(key) → résout l'ID via DB, puis délègue à findByIds
 * 3. invalidateAll() → supprime le namespace (force rechargement complet)
 * 4. invalidateOne(id) → supprime l'entrée individuelle
 *
 * Les sous-classes implémentent :
 * - queryByIds(ids[]) — accès DB pour les IDs non cachés
 * - resolveIdByNaturalKey?(key) — optionnel, permet findByNaturalKey
 */

import type { ICacheClient } from '../cache/i-cache-client.interface';

export abstract class CacheableRepository<T extends { id: string }> {
  constructor(
    protected readonly cache: ICacheClient,
    protected readonly namespace: string,
  ) {}

  /**
   * Retourne les entités correspondant aux IDs demandés.
   * Les hits cache sont servis directement ; les IDs manquants sont chargés en DB
   * puis insérés dans le cache.
   */
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];

    const keys = ids.map((id) => this.entityKey(id));
    const cached = await this.cache.mget<T>(keys);

    const missing: string[] = [];
    const result: T[] = [];

    cached.forEach((entry, index) => {
      if (entry !== null) {
        result.push(entry);
      } else {
        missing.push(ids[index]);
      }
    });

    if (missing.length > 0) {
      const fromDb = await this.queryByIds(missing);
      await this.populateCache(fromDb);
      result.push(...fromDb);
    }

    return result;
  }

  /**
   * Résout un ID à partir d'une clé naturelle (ex: code, name),
   * puis retourne l'entité via findByIds (avec cache).
   *
   * Nécessite que resolveIdByNaturalKey soit implémenté dans la sous-classe.
   */
  async findByNaturalKey(key: string): Promise<T | null> {
    const id = await this.resolveIdByNaturalKey(key);
    if (!id) return null;
    const results = await this.findByIds([id]);
    return results[0] ?? null;
  }

  /**
   * Invalide toutes les entrées du namespace (force rechargement complet
   * au prochain accès).
   */
  async invalidateAll(): Promise<void> {
    await this.cache.del(this.namespaceKey());
  }

  /** Invalide une seule entrée par ID. */
  async invalidateOne(id: string): Promise<void> {
    await this.cache.del(this.entityKey(id));
  }

  /**
   * Query DB pour les IDs demandés — implémenté par la sous-classe.
   * Doit retourner uniquement les entités trouvées (sans null).
   */
  protected abstract queryByIds(ids: string[]): Promise<T[]>;

  /**
   * Résout l'ID d'une entité à partir de sa clé naturelle.
   * Optionnel : override dans la sous-classe si findByNaturalKey est nécessaire.
   * Par défaut, rejette avec une erreur.
   */
  protected resolveIdByNaturalKey(key: string): Promise<string | null> {
    return Promise.reject(
      new Error(
        `resolveIdByNaturalKey non implémenté dans ${this.constructor.name} (key: ${key})`,
      ),
    );
  }

  /** Clé cache pour une entité individuelle : `{namespace}:{id}` */
  private entityKey(id: string): string {
    return `${this.namespace}:${id}`;
  }

  /** Clé cache pour le namespace (méta-clé de versioning) : `ns:{namespace}` */
  private namespaceKey(): string {
    return `ns:${this.namespace}`;
  }

  /** Insère les entités dans le cache. */
  private async populateCache(entities: T[]): Promise<void> {
    if (entities.length === 0) return;
    const entries = entities.map((entity) => ({
      key: this.entityKey(entity.id),
      value: entity,
    }));
    await this.cache.mset(entries);
  }
}
