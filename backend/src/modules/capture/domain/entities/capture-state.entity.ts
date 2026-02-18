import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

/**
 * CaptureState — Table référentielle
 * Valeurs: 'recording', 'captured', 'failed'
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id UUID généré dans la couche applicative (pas par PostgreSQL DEFAULT)
 * - UUIDs déterministes dans reference-data.constants.ts pour usage sans lookup DB
 *
 * Story 13.2: Ajout des champs référentiels manquants (ADR-026 R2)
 * - label, displayOrder, isActive complètent la structure référentielle
 */
@Entity('capture_states')
export class CaptureState extends BaseEntity {
  @Column({ type: 'text', unique: true })
  name!: string;

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
