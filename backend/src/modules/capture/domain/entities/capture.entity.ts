import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AppBaseEntity } from '../../../../common/entities/base.entity';
import { CaptureType } from './capture-type.entity';
import { CaptureState } from './capture-state.entity';
import { CaptureSyncStatus } from './capture-sync-status.entity';

/**
 * Capture — Entité persistante côté backend
 *
 * Permet la restauration des captures après réinstallation (NFR6 : 0 capture perdue).
 *
 * Design clé :
 * - id       : UUID backend (source of truth serveur)
 * - clientId : UUID assigné par le mobile (référence locale)
 * - UNIQUE(clientId, ownerId) : protège contre les doublons cross-device
 *
 * Le PUSH mobile envoie son id local comme clientId.
 * Le PULL retourne id (backend) + clientId pour la réconciliation mobile.
 *
 * Story 12.2: FKs typeId/stateId/syncStatusId migrées de integer vers UUID (ADR-026 AC4)
 */
@Entity('captures')
@Index('IDX_CAPTURES_CLIENT_OWNER', ['clientId', 'ownerId'], { unique: true })
@Index('IDX_CAPTURES_LAST_MODIFIED', ['lastModifiedAt'])
@Index('IDX_CAPTURES_OWNER_ID', ['ownerId'])
export class Capture extends AppBaseEntity {
  /** ID assigné par le client mobile — référence locale */
  @Column('uuid')
  clientId!: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  /** FK vers capture_types (UUID — ADR-026 AC4) */
  @Column({ type: 'uuid', name: 'typeId', nullable: true })
  typeId?: string;

  @ManyToOne(() => CaptureType, { nullable: true, eager: false })
  @JoinColumn({ name: 'typeId' })
  type?: CaptureType;

  /** FK vers capture_states (UUID — ADR-026 AC4) */
  @Column({ type: 'uuid', name: 'stateId', nullable: true })
  stateId?: string;

  @ManyToOne(() => CaptureState, { nullable: true, eager: false })
  @JoinColumn({ name: 'stateId' })
  state?: CaptureState;

  /** Chemin MinIO (audio) ou texte brut (text capture) */
  @Column({ type: 'text', nullable: true })
  rawContent?: string;

  @Column({ type: 'text', nullable: true })
  normalizedText?: string;

  /** Durée en ms (audio seulement) */
  @Column({ type: 'int', nullable: true })
  duration?: number;

  /** Taille du fichier en bytes (audio seulement) */
  @Column({ type: 'int', nullable: true })
  fileSize?: number;

  /** Timestamp ms depuis epoch — même pattern que Thought/Idea/Todo */
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number;

  /** FK vers capture_sync_statuses (UUID — ADR-026 AC4) */
  @Column({ type: 'uuid', name: 'syncStatusId' })
  syncStatusId!: string;

  @ManyToOne(() => CaptureSyncStatus, { nullable: false, eager: false })
  @JoinColumn({ name: 'syncStatusId' })
  syncStatus!: CaptureSyncStatus;
}
