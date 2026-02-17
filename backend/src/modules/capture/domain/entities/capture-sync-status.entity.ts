import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * CaptureSyncStatus — Table référentielle
 * Valeurs: 'active', 'deleted'
 */
@Entity('capture_sync_statuses')
export class CaptureSyncStatus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  name!: string;
}
