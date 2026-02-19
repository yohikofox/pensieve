/**
 * PATTERN: Repository TypeORM (NestJS)
 *
 * Source: src/modules/knowledge/application/repositories/thought.repository.ts
 *
 * RÈGLES:
 * - @Injectable() obligatoire
 * - Injecter DataSource (pas Repository directement dans le constructeur)
 * - UUID généré dans la couche applicative : uuidv7() pour les nouvelles entités
 * - Soft delete : repository.softDelete(id) — JAMAIS delete()
 * - Transactions : dataSource.transaction() pour les opérations atomiques
 * - Logger NestJS : Logger(ClassName.name)
 * - Les lectures simples retournent T | null (pas de Result)
 * - Les mutations dans des transactions retournent T ou Result<T>
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AppBaseEntity } from '../src/common/entities/base.entity';
import { Entity, Column } from 'typeorm';

// ── Entité de démonstration ────────────────────────────────────────────────
@Entity('examples')
class ExampleEntity extends AppBaseEntity {
  @Column('text') name!: string;
  @Column({ type: 'uuid', name: 'owner_id' }) ownerId!: string;
  @Column({ type: 'bigint', name: 'last_modified_at' }) lastModifiedAt!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Repository TypeORM standard
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ExampleRepository {
  private readonly logger = new Logger(ExampleRepository.name);
  private readonly repo: Repository<ExampleEntity>;

  constructor(private readonly dataSource: DataSource) {
    // ✅ Récupérer le repository depuis DataSource (pas via injection directe)
    this.repo = this.dataSource.getRepository(ExampleEntity);
  }

  /**
   * Créer une entité — UUID généré dans la couche applicative (ADR-026 R1)
   */
  async create(name: string, ownerId: string): Promise<ExampleEntity> {
    const id = uuidv7(); // ← ADR-026 R1 : UUID applicatif

    const entity = this.repo.create({
      id, // ← fournir explicitement
      name,
      ownerId,
      lastModifiedAt: Date.now(),
    });

    const saved = await this.repo.save(entity);
    this.logger.log(`example.created: ${saved.id}`);
    return saved;
  }

  /**
   * Transaction atomique : créer entité + sous-entités
   * ADR-026 R3 : les relations sont gérées explicitement, pas via cascade
   */
  async createWithChildren(
    name: string,
    ownerId: string,
    childrenNames: string[],
  ): Promise<ExampleEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const parentId = uuidv7();

      const parent = manager.create(ExampleEntity, {
        id: parentId,
        name,
        ownerId,
        lastModifiedAt: Date.now(),
      });
      const savedParent = await manager.save(ExampleEntity, parent);

      // Créer les enfants explicitement (ADR-026 R3 : pas de cascade)
      for (const childName of childrenNames) {
        const child = manager.create(ExampleEntity, {
          id: uuidv7(),
          name: childName,
          ownerId,
          lastModifiedAt: Date.now(),
        });
        await manager.save(ExampleEntity, child);
      }

      this.logger.log(
        `example.created.with-children: ${savedParent.id} (${childrenNames.length} children)`,
      );
      return savedParent;
    });
  }

  /**
   * Lecture simple — retourne T | null (pas de Result nécessaire)
   */
  async findById(id: string): Promise<ExampleEntity | null> {
    return await this.repo.findOne({ where: { id } });
  }

  /**
   * Lecture avec filtre — TypeORM filtre automatiquement les soft-deleted
   */
  async findByOwner(ownerId: string): Promise<ExampleEntity[]> {
    return await this.repo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Soft delete — ADR-026 R4 : JAMAIS delete() direct
   */
  async delete(id: string): Promise<void> {
    await this.repo.softDelete(id); // ← positionne deletedAt, ne supprime pas
    this.logger.log(`example.soft-deleted: ${id}`);
  }

  /**
   * Accès admin/audit aux entités soft-deleted
   */
  async findByIdWithDeleted(id: string): Promise<ExampleEntity | null> {
    return await this.repo.findOne({
      where: { id },
      withDeleted: true, // ← inclut les enregistrements soft-deleted
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDITS
// ─────────────────────────────────────────────────────────────────────────────

// ❌ delete() direct (contourne le soft delete ADR-026 R4)
// await this.repo.delete(id);

// ❌ UUID généré par PostgreSQL (ADR-026 R1)
// const entity = this.repo.create({ name }); // ← sans id, PostgreSQL génère l'UUID

// ❌ Cascade TypeORM (ADR-026 R3)
// @OneToMany(() => Child, c => c.parent, { cascade: ['soft-remove'] })
