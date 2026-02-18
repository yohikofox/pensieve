import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

/**
 * ThoughtStatus — Table référentielle des statuts fonctionnels d'un Thought
 *
 * Story 13.2: Créer les tables référentielles pour les statuts (ADR-026 R2)
 *
 * Valeurs: 'active', 'archived'
 *
 * UUIDs déterministes dans reference-data.constants.ts (THOUGHT_STATUS_IDS)
 * pour usage sans lookup DB.
 *
 * @see ADR-026 R2 — Tables référentielles pour les statuts catégoriels
 */
@Entity('thought_statuses')
export class ThoughtStatus extends BaseEntity {
  /** Code technique immuable — ne jamais modifier après mise en prod (ADR-026 R2) */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Libellé affiché (peut évoluer sans casser le code) */
  @Column({ type: 'varchar', length: 100 })
  label!: string;

  /** Ordre d'affichage dans les listes (0 = premier) */
  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder!: number;

  /** Indique si ce statut est actif/disponible dans l'interface */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}
