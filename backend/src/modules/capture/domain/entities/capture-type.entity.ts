import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

/**
 * CaptureType — Table référentielle
 * Valeurs: 'audio', 'text'
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id UUID généré dans la couche applicative (pas par PostgreSQL DEFAULT)
 * - UUIDs déterministes dans reference-data.constants.ts pour usage sans lookup DB
 */
@Entity('capture_types')
export class CaptureType extends BaseEntity {
  @Column({ type: 'text', unique: true })
  name!: string;
}
