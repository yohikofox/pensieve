import { Entity, Column } from 'typeorm';
import { BaseReferentialEntity } from '../../../../common/entities/base-referential.entity';

/**
 * CaptureSyncStatus — Table référentielle
 * Valeurs: 'active', 'deleted'
 *
 * ADR-026 R6: Extends BaseReferentialEntity (isActive hérité, sans deletedAt)
 * ADR-027: Cache via CaptureSyncStatusRepository
 */
@Entity('capture_sync_statuses')
export class CaptureSyncStatus extends BaseReferentialEntity {
  @Column({ type: 'text', unique: true })
  name!: string;
}
