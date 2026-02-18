import { Entity, Column } from 'typeorm';
import { BaseReferentialEntity } from '../../../../common/entities/base-referential.entity';

/**
 * ThoughtStatus — Table référentielle des statuts fonctionnels d'un Thought
 *
 * Valeurs: 'active', 'archived'
 *
 * ADR-026 R6: Extends BaseReferentialEntity (isActive hérité, sans deletedAt)
 * ADR-027: Cache via ThoughtStatusRepository
 *
 * @see ADR-026 R2 — Tables référentielles pour les statuts catégoriels
 */
@Entity('thought_statuses')
export class ThoughtStatus extends BaseReferentialEntity {
  /** Code technique immuable — ne jamais modifier après mise en prod (ADR-026 R2) */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Libellé affiché (peut évoluer sans casser le code) */
  @Column({ type: 'varchar', length: 100 })
  label!: string;

  /** Ordre d'affichage dans les listes (0 = premier) */
  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder!: number;
}
