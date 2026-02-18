/**
 * BaseReferentialEntity — Entité de base pour les tables référentielles
 *
 * ADR-026 R6: Les entités référentielles (ex: capture_types, thought_statuses)
 * n'ont pas de soft-delete. Elles utilisent `isActive` pour désactiver une valeur
 * sans la supprimer physiquement ou logiquement via deletedAt.
 *
 * Différence avec BaseEntity :
 * - Pas de deletedAt — les référentiels ne sont jamais "supprimés"
 * - isActive présent — permet de désactiver une valeur sans la retirer
 *
 * Usage:
 * ```typescript
 * @Entity('capture_types')
 * export class CaptureType extends BaseReferentialEntity {
 *   @Column({ type: 'text', unique: true })
 *   name!: string;
 * }
 * ```
 *
 * @see ADR-026 — Backend Data Model Design Rules
 * @see ADR-027 — Unit Cache Strategy for Referential Data
 */

import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

export abstract class BaseReferentialEntity {
  /**
   * Clé primaire UUID fournie par la couche domaine.
   * ADR-026 R1 + R6 : UUID généré dans le domaine, pas par la DB.
   */
  @PrimaryColumn('uuid')
  id!: string;

  /** Timestamp de création — TIMESTAMPTZ (ADR-026 R5) */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Timestamp de dernière modification — TIMESTAMPTZ (ADR-026 R5) */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Indicateur d'activité — remplace le soft-delete pour les référentiels.
   * false = valeur désactivée (ne plus proposer dans l'UI) mais conservée en DB.
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}
