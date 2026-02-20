import { Entity, Column } from 'typeorm';
import { BaseReferentialEntity } from '../../../../common/entities/base-referential.entity';

/**
 * CaptureState — Table référentielle
 * Valeurs: 'recording', 'captured', 'failed', 'processing', 'ready'
 *
 * ADR-026 R6: Extends BaseReferentialEntity (isActive hérité, sans deletedAt)
 * ADR-027: Cache via CaptureStateRepository
 */
@Entity('capture_states')
export class CaptureState extends BaseReferentialEntity {
  @Column({ type: 'text', unique: true })
  name!: string;

  /** Libellé affiché (peut évoluer sans casser le code) */
  @Column({ type: 'varchar', length: 100 })
  label!: string;

  /** Ordre d'affichage dans les listes (0 = premier) */
  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder!: number;
}
