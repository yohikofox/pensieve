/**
 * BaseEntity — Entité de base partagée pour toutes les entités backend
 *
 * Story 12.1: Créer la BaseEntity Partagée Backend (ADR-026 R6)
 *
 * Définit les colonnes communes une seule fois :
 * - id       : UUID fourni par la couche domaine (@PrimaryColumn, pas @PrimaryGeneratedColumn)
 * - createdAt: Timestamp de création (TIMESTAMPTZ — ADR-026 R5)
 * - updatedAt: Timestamp de dernière modification (TIMESTAMPTZ — ADR-026 R5)
 * - deletedAt: Timestamp de suppression douce, nullable (ADR-026 R4)
 *
 * Usage:
 * ```typescript
 * @Entity('my_table')
 * export class MyEntity extends BaseEntity {
 *   // id, createdAt, updatedAt, deletedAt sont hérités — ne pas les redéclarer
 *   @Column('text')
 *   name!: string;
 * }
 * ```
 *
 * @see ADR-026 — Backend Data Model Design Rules
 */

import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  /**
   * Clé primaire UUID fournie par la couche domaine.
   *
   * ADR-026 R1 + R6 : L'UUID est généré dans le domaine (crypto.randomUUID()),
   * pas par la base de données. Aucun DEFAULT côté DB.
   */
  @PrimaryColumn('uuid')
  id!: string;

  /**
   * Timestamp de création — TIMESTAMPTZ pour cohérence timezone (ADR-026 R5)
   */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Timestamp de dernière modification — TIMESTAMPTZ (ADR-026 R5)
   */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Timestamp de suppression douce — nullable par défaut (ADR-026 R4)
   *
   * TypeORM active automatiquement le soft delete via :
   * - repository.softDelete(id) — positionne ce champ
   * - repository.find() — filtre les enregistrements supprimés par défaut
   * - repository.find({ withDeleted: true }) — inclut les supprimés
   */
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
