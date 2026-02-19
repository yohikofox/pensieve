/**
 * Tests d'Architecture — Pensieve Backend
 *
 * Ces tests vérifient les contraintes structurelles (ADRs).
 * Ils échouent si une règle est violée — même involontairement.
 *
 * Pattern : Jest pur + fs. Aucune dépendance externe.
 * Référence : pensieve/backend/_patterns/
 */

import { readFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

describe('Architecture constraints — Backend', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // ADR-026 R1 — UUID applicatif : pas de @PrimaryGeneratedColumn dans les entités
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-026 R1 : aucun @PrimaryGeneratedColumn dans les entités (UUID généré applicativement)', () => {
    const entityFiles = globSync(`${SRC}/**/entities/**/*.entity.ts`);
    const violations = entityFiles.filter((file) => {
      const content = readFileSync(file, 'utf-8');
      return content.includes('@PrimaryGeneratedColumn');
    });

    if (violations.length > 0) {
      console.error('Violations ADR-026 R1 (@PrimaryGeneratedColumn):');
      violations.forEach((f) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-026 R6 — AppBaseEntity : toutes les entités étendent AppBaseEntity
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-026 R6 : toutes les entités @Entity() étendent AppBaseEntity', () => {
    const entityFiles = globSync(`${SRC}/**/entities/**/*.entity.ts`);
    const violations = entityFiles.filter((file) => {
      const content = readFileSync(file, 'utf-8');
      // Fichier qui déclare @Entity() mais n'étend pas AppBaseEntity
      return (
        content.includes('@Entity(') &&
        !content.includes('extends AppBaseEntity') &&
        // Exclure les lookup tables minimalistes qui peuvent ne pas hériter (cas rares documentés)
        !content.includes('// ADR-026 exception')
      );
    });

    if (violations.length > 0) {
      console.error('Violations ADR-026 R6 (pas extends AppBaseEntity):');
      violations.forEach((f) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-026 R3 — Pas de cascade TypeORM dans les entités
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-026 R3 : aucune cascade TypeORM dans les entités (suppressions explicites)', () => {
    const entityFiles = globSync(`${SRC}/**/entities/**/*.entity.ts`);
    const violations: string[] = [];

    entityFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          line.includes('cascade') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
        ) {
          violations.push(`${path.relative(SRC, file)}:${idx + 1}`);
        }
      });
    });

    if (violations.length > 0) {
      console.error('Violations ADR-026 R3 (cascade TypeORM):');
      violations.forEach((v) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-023 — Result Pattern : les services applicatifs ne throw pas
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-023 : aucun "throw new Error" dans les services applicatifs (utiliser Result<T>)', () => {
    const serviceFiles = globSync(`${SRC}/**/application/services/**/*.ts`, {
      ignore: [`${SRC}/**/*.spec.ts`],
    });

    const violations: string[] = [];

    serviceFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          /throw new Error/.test(line) &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
        ) {
          violations.push(
            `${path.relative(SRC, file)}:${idx + 1} — "${line.trim()}"`,
          );
        }
      });
    });

    if (violations.length > 0) {
      console.error('Violations ADR-023 (throw new Error dans service):');
      violations.forEach((v) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-026 R4 — Soft delete : pas de repository.delete() direct
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-026 R4 : pas de .delete() TypeORM direct (utiliser .softDelete())', () => {
    const repoFiles = globSync(`${SRC}/**/repositories/**/*.ts`, {
      ignore: [`${SRC}/**/*.spec.ts`],
    });

    const violations: string[] = [];

    repoFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Détecter .delete( mais pas .softDelete(
        if (
          /\.(delete|remove)\(/.test(line) &&
          !line.includes('softDelete') &&
          !line.includes('softRemove') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*') &&
          !line.includes('// ADR-026 exception') // escape hatch documenté
        ) {
          violations.push(
            `${path.relative(SRC, file)}:${idx + 1} — "${line.trim()}"`,
          );
        }
      });
    });

    if (violations.length > 0) {
      console.error('Violations ADR-026 R4 (.delete() direct):');
      violations.forEach((v) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Boundaries : les controllers ne font pas d'accès DB direct (DataSource)
  // ───────────────────────────────────────────────────────────────────────────

  it('Controllers ne doivent pas injecter DataSource directement', () => {
    const controllerFiles = globSync(`${SRC}/**/controllers/**/*.ts`, {
      ignore: [`${SRC}/**/*.spec.ts`],
    });

    const violations = controllerFiles.filter((file) => {
      const content = readFileSync(file, 'utf-8');
      return content.includes('DataSource') && content.includes('@Controller(');
    });

    if (violations.length > 0) {
      console.error('Violations boundary (DataSource dans controller):');
      violations.forEach((f) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Logger : pas de console.log dans les services (utiliser Logger NestJS)
  // ───────────────────────────────────────────────────────────────────────────

  it('Pas de console.log dans les services (utiliser Logger NestJS)', () => {
    const files = globSync(`${SRC}/**/application/**/*.ts`, {
      ignore: [`${SRC}/**/*.spec.ts`],
    });

    const violations: string[] = [];

    files.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          /console\.(log|error|warn|debug)/.test(line) &&
          !line.trim().startsWith('//')
        ) {
          violations.push(`${path.relative(SRC, file)}:${idx + 1}`);
        }
      });
    });

    if (violations.length > 0) {
      console.error('console.log dans services (utiliser Logger NestJS):');
      violations.forEach((v) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-028 — Pas de "any" explicite dans le code source
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-028 : pas de "any" explicite dans le code source TypeScript', () => {
    const files = globSync(`${SRC}/**/*.ts`, {
      ignore: [
        `${SRC}/**/*.spec.ts`,
        `${SRC}/**/__mocks__/**`,
        `${SRC}/**/mocks/**`,
        `${SRC}/**/*.d.ts`,
      ],
    });

    const violations: string[] = [];

    files.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Détecter : any en fin de type ou as any, sans attraper les commentaires
        if (
          /:\s*any(\s*[;,)\]|]|$)/.test(line) ||
          /\bas\s+any\b/.test(line)
        ) {
          violations.push(`${path.relative(SRC, file)}:${idx + 1} — "${trimmed}"`);
        }
      });
    });

    if (violations.length > 0) {
      console.error('Violations ADR-028 (any explicite — utiliser types précis):');
      violations.forEach((v) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });
});
