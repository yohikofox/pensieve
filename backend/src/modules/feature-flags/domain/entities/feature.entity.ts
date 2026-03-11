import { Column, Entity } from 'typeorm';
import { AppBaseEntity } from '../../../../common/entities/base.entity';

/**
 * Feature — Référentiel des feature flags du système
 * Story 24.1: Feature Flag System — Backend Data Model & Resolution Engine (AC1)
 *
 * Représente une feature connue du système. Chaque feature a une clé unique
 * et une valeur par défaut (false par défaut = sécurisé).
 *
 * @see ADR-026 — Backend Data Model Design Rules
 */
@Entity('features')
export class Feature extends AppBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'boolean', default: false, name: 'default_value' })
  defaultValue!: boolean;

  @Column({ type: 'boolean', default: false })
  deprecated: boolean = false;
}
