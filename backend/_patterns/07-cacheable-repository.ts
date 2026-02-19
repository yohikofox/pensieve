/**
 * Pattern 07 — Cacheable Repository (ADR-027)
 *
 * ADR-027 : Cache opt-in pour les données référentielles via CacheableRepository<T>.
 *
 * RÈGLE : N'utiliser ce pattern QUE pour les données référentielles stables
 *   (rôles, permissions, tiers, langues…). Les données utilisateur ne vont PAS en cache.
 *
 * Algorithme interne :
 * 1. findByIds(ids) → vérifie mget en cache, ne query que les IDs manquants, mset les résultats
 * 2. findByNaturalKey(key) → resolve l'ID via DB, délègue à findByIds
 * 3. invalidateAll()  → vide le namespace entier (ex: reload config)
 * 4. invalidateOne(id) → vide une entrée individuelle
 *
 * Implémentations de ICacheClient :
 *   - RedisCacheClient (production)
 *   - InMemoryCacheClient (tests)
 *
 * ─────────────────────────────────────────────────────────────────
 * INTERFACE ICacheClient (src/common/cache/i-cache-client.interface.ts)
 * ─────────────────────────────────────────────────────────────────
 */

// export interface ICacheClient {
//   get<T>(key: string): Promise<T | null>;
//   mget<T>(keys: string[]): Promise<(T | null)[]>;
//   set<T>(key: string, value: T): Promise<void>;
//   mset<T>(entries: { key: string; value: T }[]): Promise<void>;
//   del(key: string): Promise<void>;
// }

// ─────────────────────────────────────────────────────────────────
// EXEMPLE — RoleRepository avec cache (données référentielles)
// ─────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Inject } from '@nestjs/common';

import { CacheableRepository } from 'src/common/repositories/cacheable.repository';
import type { ICacheClient } from 'src/common/cache/i-cache-client.interface';

// ─── Entité fictive pour l'exemple ───────────────────────────────

import { Entity, Column } from 'typeorm';
import { AppBaseEntity } from 'src/common/entities/base.entity';

@Entity('roles')
class RoleEntity extends AppBaseEntity {
  @Column({ unique: true })
  code!: string; // clé naturelle : 'admin', 'user', 'viewer'

  @Column()
  label!: string;
}

// ─── Repository avec cache ────────────────────────────────────────

@Injectable()
export class RoleRepository extends CacheableRepository<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @Inject('ICacheClient')
    cache: ICacheClient,
  ) {
    // Le namespace isole les clés de ce repository : "role:uuid-xxx"
    super(cache, 'role');
  }

  /**
   * Implémentation obligatoire — accès DB pour les IDs non cachés.
   * CacheableRepository appellera cette méthode uniquement pour les cache misses.
   */
  protected async queryByIds(ids: string[]): Promise<RoleEntity[]> {
    return this.roleRepo
      .createQueryBuilder('role')
      .where('role.id IN (:...ids)', { ids })
      .andWhere('role.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Optionnel — permet findByNaturalKey('admin') → résout en UUID → findByIds
   * N'override que si la clé naturelle est nécessaire en dehors de l'ID.
   */
  protected async resolveIdByNaturalKey(code: string): Promise<string | null> {
    const role = await this.roleRepo.findOne({
      where: { code },
      select: ['id'],
    });
    return role?.id ?? null;
  }

  // ─── Méthodes de domaine supplémentaires (non cachées) ──────────

  /**
   * Les méthodes hors findByIds/findByNaturalKey ne passent PAS par le cache.
   * Elles accèdent directement à la DB. C'est normal pour les données mutables.
   */
  async findAll(): Promise<RoleEntity[]> {
    return this.roleRepo.find({ where: { deletedAt: IsNull() } });
  }
}

// ─────────────────────────────────────────────────────────────────
// UTILISATION dans un Service
// ─────────────────────────────────────────────────────────────────

@Injectable()
class AuthorizationService {
  constructor(private readonly roleRepository: RoleRepository) {}

  async getRolesForUser(roleIds: string[]): Promise<RoleEntity[]> {
    // ✅ findByIds → cache d'abord, DB pour les misses
    return this.roleRepository.findByIds(roleIds);
  }

  async getRoleByCode(code: string): Promise<RoleEntity | null> {
    // ✅ findByNaturalKey → résout via DB, sert via cache
    return this.roleRepository.findByNaturalKey(code);
  }

  async reloadRoles(): Promise<void> {
    // ✅ invalidateAll() après une mise à jour de configuration
    await this.roleRepository.invalidateAll();
  }
}

// ─────────────────────────────────────────────────────────────────
// ENREGISTREMENT dans le Module
// ─────────────────────────────────────────────────────────────────

// Dans authorization.module.ts :
//
// @Module({
//   imports: [
//     TypeOrmModule.forFeature([RoleEntity]),
//   ],
//   providers: [
//     RoleRepository,
//     {
//       provide: 'ICacheClient',
//       useClass: RedisCacheClient,   // production
//       // useClass: InMemoryCacheClient, // tests
//     },
//   ],
//   exports: [RoleRepository],
// })
// export class AuthorizationModule {}

// ─────────────────────────────────────────────────────────────────
// ANTI-PATTERNS À ÉVITER
// ─────────────────────────────────────────────────────────────────

/*
// ❌ JAMAIS — CacheableRepository pour des données mutables (pensées utilisateur)
class ThoughtRepository extends CacheableRepository<ThoughtEntity> { ... }

// ❌ JAMAIS — accès Redis directement dans un Service (passe par le repository)
@Injectable()
class SomeService {
  constructor(@Inject('ICacheClient') private cache: ICacheClient) {}
  async doWork() {
    const raw = await this.cache.get('role:abc'); // bypass du pattern
  }
}

// ✅ TOUJOURS — utiliser findByIds/findByNaturalKey depuis le service
const roles = await roleRepository.findByIds(['uuid-1', 'uuid-2']);
*/

export { AuthorizationService };
