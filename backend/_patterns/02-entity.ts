/**
 * PATTERN: Entité TypeORM (ADR-026)
 *
 * Source:
 *   - src/common/entities/base.entity.ts   (AppBaseEntity)
 *   - src/modules/knowledge/domain/entities/thought.entity.ts
 *   - src/modules/capture/domain/entities/capture.entity.ts
 *
 * RÈGLES ABSOLUES (ADR-026):
 * R1: @PrimaryColumn('uuid') — JAMAIS @PrimaryGeneratedColumn
 *     UUID généré dans la couche applicative (crypto.randomUUID() ou uuidv7())
 * R2: FKs de lookup tables → UUID, pas integer
 * R3: Pas de cascade TypeORM — suppressions explicites en transaction
 * R4: Soft delete via deletedAt hérité — JAMAIS DELETE SQL direct
 * R5: Timestamps TIMESTAMPTZ — hérités de AppBaseEntity, ne pas redéclarer
 * R6: Toujours extends AppBaseEntity — jamais de BaseEntity TypeORM natif
 *
 * Colonnes héritées de AppBaseEntity (NE PAS redéclarer) :
 *   - id        : string (UUID)
 *   - createdAt : Date (TIMESTAMPTZ)
 *   - updatedAt : Date (TIMESTAMPTZ)
 *   - deletedAt : Date | null (TIMESTAMPTZ, soft delete)
 */

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AppBaseEntity } from '../src/common/entities/base.entity';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : entité simple
// ─────────────────────────────────────────────────────────────────────────────

@Entity('examples')
@Index('IDX_EXAMPLES_OWNER_ID', ['ownerId']) // ← Index sur les FKs fréquentes
export class ExampleEntity extends AppBaseEntity {
  // ← extends AppBaseEntity (R6)
  // ownerId : UUID du propriétaire (pattern commun à toutes les entités)
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column('text')
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Timestamp ms depuis epoch — pour la synchronisation mobile */
  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number;

  // ADR-026 R3 : relations sans cascade
  // La suppression des ExampleItems est gérée explicitement par ExampleDeleteService
  @OneToMany(() => ExampleItemEntity, (item) => item.example)
  items!: ExampleItemEntity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : entité avec FK vers une lookup table UUID (ADR-026 R2)
// ─────────────────────────────────────────────────────────────────────────────

@Entity('example_statuses')
export class ExampleStatusEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string; // 'pending', 'active', 'completed'

  @Column('text')
  label!: string;
}

@Entity('example_items')
export class ExampleItemEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'example_id' })
  exampleId!: string;

  @ManyToOne(() => ExampleEntity, { nullable: false, eager: false })
  @JoinColumn({ name: 'example_id' })
  example?: ExampleEntity;

  /** FK vers lookup table UUID (ADR-026 R2) */
  @Column({ type: 'uuid', name: 'status_id' })
  statusId!: string;

  @ManyToOne(() => ExampleStatusEntity, { nullable: false, eager: false })
  @JoinColumn({ name: 'status_id' })
  status?: ExampleStatusEntity;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column('text')
  content!: string;

  @Column({ type: 'bigint', name: 'last_modified_at' })
  lastModifiedAt!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : violations ADR-026
// ─────────────────────────────────────────────────────────────────────────────

// import { PrimaryGeneratedColumn, BaseEntity } from 'typeorm';
//
// @Entity('wrong_examples')
// export class WrongEntity extends BaseEntity {   // ❌ R6 : BaseEntity TypeORM natif
//   @PrimaryGeneratedColumn('uuid')              // ❌ R1 : UUID généré par PostgreSQL
//   id!: string;
//
//   @OneToMany(() => WrongItemEntity, (item) => item.example, {
//     cascade: ['soft-remove'],                  // ❌ R3 : cascade TypeORM interdite
//   })
//   items!: WrongItemEntity[];
//
//   @Column({ type: 'integer', name: 'status_id' }) // ❌ R2 : FK integer vers lookup table
//   statusId!: number;
// }
