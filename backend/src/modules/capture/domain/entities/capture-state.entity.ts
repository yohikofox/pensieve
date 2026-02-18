import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

/**
 * CaptureState — Table référentielle
 * Valeurs: 'recording', 'captured', 'failed'
 *
 * Story 12.2: Extends BaseEntity (ADR-026 R1, R6)
 * - id UUID généré dans la couche applicative (pas par PostgreSQL DEFAULT)
 * - UUIDs déterministes dans reference-data.constants.ts pour usage sans lookup DB
 */
@Entity('capture_states')
export class CaptureState extends BaseEntity {
  @Column({ type: 'text', unique: true })
  name!: string;
}
