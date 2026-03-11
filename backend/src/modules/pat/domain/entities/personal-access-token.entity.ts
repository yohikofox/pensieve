import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * PersonalAccessToken — Entité PAT (Story 27.1)
 *
 * // ADR-026 exception : schéma divergent de AppBaseEntity — pas de updatedAt/deletedAt,
 * gestion de révocation via revoked_at dédié (soft-revoke sans soft-delete générique).
 *
 * Le token brut n'est JAMAIS stocké — uniquement son hash SHA-256.
 */
@Entity('personal_access_tokens') // ADR-026 exception
export class PersonalAccessToken {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ length: 100 })
  name!: string;

  /** SHA-256 du token brut — jamais exposé via l'API */
  @Column({ name: 'token_hash', length: 64, unique: true })
  tokenHash!: string;

  /** 12 premiers caractères du token (ex: "pns_aBcDeFgH") pour identification */
  @Column({ length: 12 })
  prefix!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  scopes!: string[];

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null = null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null = null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
