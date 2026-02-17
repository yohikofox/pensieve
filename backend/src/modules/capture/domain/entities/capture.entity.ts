import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
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
 * - UNIQUE(clientId, userId) : protège contre les doublons cross-device
 *
 * Le PUSH mobile envoie son id local comme clientId.
 * Le PULL retourne id (backend) + clientId pour la réconciliation mobile.
 */
@Entity('captures')
@Index('IDX_CAPTURES_CLIENT_USER', ['clientId', 'userId'], { unique: true })
@Index('IDX_CAPTURES_LAST_MODIFIED', ['lastModifiedAt'])
@Index('IDX_CAPTURES_USER_ID', ['userId'])
export class Capture {
  /** ID backend généré — source of truth côté serveur */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** ID assigné par le client mobile — référence locale */
  @Column('uuid')
  clientId!: string;

  @Column('uuid')
  userId!: string;

  /** FK vers capture_types (colonne explicite pour accès direct) */
  @Column({ name: 'typeId', nullable: true })
  typeId?: number;

  @ManyToOne(() => CaptureType, { nullable: true, eager: false })
  @JoinColumn({ name: 'typeId' })
  type?: CaptureType;

  /** FK vers capture_states (colonne explicite pour accès direct) */
  @Column({ name: 'stateId', nullable: true })
  stateId?: number;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /** Timestamp ms depuis epoch — même pattern que Thought/Idea/Todo */
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number;

  /** FK vers capture_sync_statuses (colonne explicite pour filtrage direct) */
  @Column({ name: 'syncStatusId', default: 1 })
  syncStatusId!: number;

  @ManyToOne(() => CaptureSyncStatus, { nullable: false, eager: false })
  @JoinColumn({ name: 'syncStatusId' })
  syncStatus!: CaptureSyncStatus;
}
