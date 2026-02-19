/**
 * Tests d'Architecture — Pensieve Mobile
 *
 * Ces tests vérifient les contraintes structurelles du projet.
 * Ils échouent si un ADR est violé — même involontairement.
 *
 * Pattern : pas de dépendance externe, Jest pur + fs.
 * Référence : pensieve/mobile/_patterns/
 */

import { readFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

describe('Architecture constraints', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-023 — Result Pattern : pas de throw dans domain/data/application
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-023 : aucun "throw new" dans les repositories (data/)', () => {
    const files = globSync(`${SRC}/contexts/**/data/**/*.ts`);
    const violations = files.filter(file => {
      const content = readFileSync(file, 'utf-8');
      // Autoriser "throw new" uniquement dans les commentaires
      const lines = content.split('\n').filter(line =>
        !line.trim().startsWith('//') && !line.trim().startsWith('*')
      );
      return lines.some(line => /throw new/.test(line));
    });

    if (violations.length > 0) {
      console.error('Violations ADR-023 (throw dans repository):');
      violations.forEach(f => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-021 — Transient First : pas de registerSingleton sans justification
  // Le container.ts DOIT avoir un commentaire "ADR-021" pour chaque singleton
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-021 : chaque registerSingleton dans container.ts doit avoir un commentaire justificatif', () => {
    const containerPath = `${SRC}/infrastructure/di/container.ts`;
    const content = readFileSync(containerPath, 'utf-8');
    const lines = content.split('\n');

    const violations: number[] = [];
    lines.forEach((line, idx) => {
      if (line.includes('registerSingleton') && !line.trim().startsWith('//')) {
        // La ligne précédente doit contenir un commentaire avec "SINGLETON" ou "ADR-021"
        const prevLine = lines[idx - 1] ?? '';
        if (!prevLine.includes('SINGLETON') && !prevLine.includes('ADR-021')) {
          violations.push(idx + 1);
        }
      }
    });

    if (violations.length > 0) {
      console.error('Lignes sans justification ADR-021:', violations);
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-019 — Domain Events : les events doivent être readonly
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-019 : les interfaces d\'events doivent avoir toutes les propriétés readonly', () => {
    const eventFiles = globSync(`${SRC}/contexts/**/events/**/*.ts`);
    const violations: string[] = [];

    eventFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');
      // Détecter une interface qui hérite de DomainEvent et a des propriétés non-readonly
      if (content.includes('extends DomainEvent')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          // Propriété de type déclarée sans readonly dans une interface
          if (/^\s+\w+\s*[?:]/.test(line) && !line.trim().startsWith('readonly') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            violations.push(`${path.relative(SRC, file)}:${idx + 1} — "${line.trim()}"`);
          }
        });
      }
    });

    if (violations.length > 0) {
      console.error('Propriétés non-readonly dans les events:');
      violations.forEach(v => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-017 — DI : pas de résolution container au niveau module
  // ───────────────────────────────────────────────────────────────────────────

  it('ADR-017 : pas de container.resolve() au niveau module (hors container.ts et hooks)', () => {
    const files = globSync(`${SRC}/**/*.ts`, {
      ignore: [
        `${SRC}/infrastructure/di/container.ts`,
        `${SRC}/**/hooks/**/*.ts`,
        `${SRC}/**/hooks.ts`,
        `${SRC}/config/bootstrap.ts`,
      ],
    });

    const violations = files.filter(file => {
      const content = readFileSync(file, 'utf-8');
      // container.resolve() en dehors d'une fonction (au top-level du module)
      // Heuristique : ligne sans indentation qui contient container.resolve
      return content.split('\n').some(line =>
        /^(?![\s\/]).*container\.resolve/.test(line)
      );
    });

    if (violations.length > 0) {
      console.error('container.resolve() au niveau module:');
      violations.forEach(f => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tokens : tous les tokens dans TOKENS doivent utiliser Symbol.for()
  // ───────────────────────────────────────────────────────────────────────────

  it('Tokens DI : tous les Symbol doivent utiliser Symbol.for() (pas Symbol())', () => {
    const tokensFile = `${SRC}/infrastructure/di/tokens.ts`;
    const content = readFileSync(tokensFile, 'utf-8');
    const violations = content.split('\n').filter(line =>
      line.includes('Symbol(') && !line.includes('Symbol.for(') && !line.trim().startsWith('//')
    );

    expect(violations).toHaveLength(0);
  });

});
