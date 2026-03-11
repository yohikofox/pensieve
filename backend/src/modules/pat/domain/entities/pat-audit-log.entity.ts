import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * PATAuditLog — Entité d'audit des actions admin sur les PATs (Story 27.3)
 *
 * // ADR-026 exception : pas de updatedAt/deletedAt — les logs d'audit sont
 * immuables par nature. Même pattern que PersonalAccessToken.
 *
 * Pas de FK vers personal_access_tokens ou users :
 * les logs restent même si le PAT/user est supprimé.
 */
@Entity('pat_audit_logs') // ADR-026 exception
export class PATAuditLog {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'admin_id' })
  adminId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'pat_id' })
  patId!: string;

  /** 'create' | 'revoke' | 'renew' */
  @Column({ length: 20 })
  action!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
