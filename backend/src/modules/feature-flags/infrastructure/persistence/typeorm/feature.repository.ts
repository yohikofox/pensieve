import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature } from '../../../domain/entities/feature.entity';

/**
 * FeatureRepository — CRUD pour le référentiel des features
 * Story 24.1: Feature Flag System (AC4)
 * Story 24.2: Ajout create/update/findById pour API admin (AC1)
 */
@Injectable()
export class FeatureRepository {
  constructor(
    @InjectRepository(Feature)
    private readonly repo: Repository<Feature>,
  ) {}

  async findAll(): Promise<Feature[]> {
    return this.repo.find();
  }

  async findByKey(key: string): Promise<Feature | null> {
    return this.repo.findOne({ where: { key } });
  }

  async findById(id: string): Promise<Feature | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: {
    key: string;
    description?: string;
    defaultValue?: boolean;
  }): Promise<Feature> {
    const feature = this.repo.create({
      key: data.key,
      description: data.description ?? null,
      defaultValue: data.defaultValue ?? false,
    });
    return this.repo.save(feature);
  }

  async update(
    id: string,
    patch: { description?: string; defaultValue?: boolean },
  ): Promise<Feature | null> {
    const toUpdate: Partial<Feature> = {};
    if (patch.description !== undefined) toUpdate.description = patch.description;
    if (patch.defaultValue !== undefined) toUpdate.defaultValue = patch.defaultValue;
    await this.repo.update(id, toUpdate);
    return this.findById(id);
  }
}
