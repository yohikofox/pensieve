/**
 * Tests unitaires — BaseReferentialEntity
 *
 * ADR-026 R6 + ADR-027: Entité de base pour les tables référentielles.
 *
 * Vérifie :
 * - id : @PrimaryColumn UUID sans auto-génération
 * - createdAt et updatedAt en TIMESTAMPTZ
 * - isActive : boolean avec valeur par défaut true
 * - Pas de deletedAt — les référentiels ne supportent pas le soft-delete
 */

import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { BaseReferentialEntity } from './base-referential.entity';

describe('BaseReferentialEntity', () => {
  it('should define id as @PrimaryColumn without auto-generation', () => {
    const storage = getMetadataArgsStorage();

    const columns = storage.columns.filter(
      (col) => col.target === BaseReferentialEntity,
    );
    const idColumn = columns.find((col) => col.propertyName === 'id');
    expect(idColumn).toBeDefined();

    // Aucune auto-génération DB
    const generations = storage.generations.filter(
      (col) => col.target === BaseReferentialEntity,
    );
    const generatedId = generations.find((col) => col.propertyName === 'id');
    expect(generatedId).toBeUndefined();
  });

  it('should have createdAt and updatedAt with timestamptz type', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(
      (col) => col.target === BaseReferentialEntity,
    );

    const createdAt = columns.find((col) => col.propertyName === 'createdAt');
    const updatedAt = columns.find((col) => col.propertyName === 'updatedAt');

    expect(createdAt?.options?.type).toBe('timestamptz');
    expect(updatedAt?.options?.type).toBe('timestamptz');
  });

  it('should have isActive column with boolean type and default true', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(
      (col) => col.target === BaseReferentialEntity,
    );

    const isActive = columns.find((col) => col.propertyName === 'isActive');
    expect(isActive).toBeDefined();
    expect(isActive?.options?.type).toBe('boolean');
    expect(isActive?.options?.default).toBe(true);
  });

  it('should NOT have a deletedAt column (no soft-delete for referential data)', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(
      (col) => col.target === BaseReferentialEntity,
    );

    const deletedAt = columns.find((col) => col.propertyName === 'deletedAt');
    expect(deletedAt).toBeUndefined();
  });
});
