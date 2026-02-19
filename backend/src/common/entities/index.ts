/**
 * Barrel file — Common Entities
 *
 * Exporte les entités de base partagées pour tous les bounded contexts.
 * Utiliser ces imports plutôt que des chemins relatifs profonds.
 *
 * Usage:
 * ```typescript
 * import { AppBaseEntity } from 'src/common/entities';
 * ```
 */

export { AppBaseEntity } from './base.entity';
export { BaseReferentialEntity } from './base-referential.entity';
