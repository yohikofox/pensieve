import { Entity, Column } from 'typeorm';
import { BaseReferentialEntity } from '../../../../common/entities/base-referential.entity';

/**
 * CaptureType — Table référentielle
 * Valeurs: 'audio', 'text'
 *
 * ADR-026 R6: Extends BaseReferentialEntity (isActive, sans deletedAt)
 * ADR-027: Cache via CaptureTypeRepository
 */
@Entity('capture_types')
export class CaptureType extends BaseReferentialEntity {
  @Column({ type: 'text', unique: true })
  name!: string;
}
