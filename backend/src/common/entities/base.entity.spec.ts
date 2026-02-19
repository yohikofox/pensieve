/**
 * Tests unitaires — BaseEntity
 *
 * Story 12.1: Créer la BaseEntity Partagée Backend (ADR-026 R6)
 *
 * Vérifie que BaseEntity définit correctement :
 * - id via @PrimaryColumn (UUID fourni par le domaine, pas auto-généré)
 * - createdAt et updatedAt en TIMESTAMPTZ
 * - deletedAt nullable (soft delete — ADR-026 R4)
 */

import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AppBaseEntity } from './base.entity';

describe('AppBaseEntity', () => {
  it('should define id as @PrimaryColumn without auto-generation', () => {
    const storage = getMetadataArgsStorage();

    // L'id doit être dans les colonnes (via @PrimaryColumn)
    const columns = storage.columns.filter(
      (col) => col.target === AppBaseEntity,
    );
    const idColumn = columns.find((col) => col.propertyName === 'id');
    expect(idColumn).toBeDefined();

    // L'id ne doit PAS être dans generations (aucune auto-génération DB)
    const generations = storage.generations.filter(
      (col) => col.target === AppBaseEntity,
    );
    const generatedId = generations.find((col) => col.propertyName === 'id');
    expect(generatedId).toBeUndefined();
  });

  it('should have deletedAt column that is nullable with timestamptz type', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(
      (col) => col.target === AppBaseEntity,
    );
    const deletedAtColumn = columns.find(
      (col) => col.propertyName === 'deletedAt',
    );
    expect(deletedAtColumn).toBeDefined();
    expect(deletedAtColumn?.options?.nullable).toBe(true);
    expect(deletedAtColumn?.options?.type).toBe('timestamptz');
  });

  it('should have createdAt and updatedAt with timestamptz type', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(
      (col) => col.target === AppBaseEntity,
    );

    const createdAtColumn = columns.find(
      (col) => col.propertyName === 'createdAt',
    );
    const updatedAtColumn = columns.find(
      (col) => col.propertyName === 'updatedAt',
    );

    expect(createdAtColumn).toBeDefined();
    expect(createdAtColumn?.options?.type).toBe('timestamptz');

    expect(updatedAtColumn).toBeDefined();
    expect(updatedAtColumn?.options?.type).toBe('timestamptz');
  });
});
