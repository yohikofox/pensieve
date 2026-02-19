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
import path from 'path';

// glob v7 — API sync : glob.sync(pattern, [options])
// @types/glob absent du projet mobile, cast manuel
// eslint-disable-next-line @typescript-eslint/no-var-requires
const glob = require('glob') as {
  sync: (pattern: string, opts?: { ignore?: string | string[] }) => string[];
};

const SRC = path.resolve(__dirname, '../../src');

describe('Architecture constraints', () => {

  it('ADR-023 : aucun "throw new" dans les repositories (data/)', () => {
    const files = glob.sync(`${SRC}/contexts/**/data/**/*.ts`);
    const violations = files.filter((file: string) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n').filter((line: string) =>
        !line.trim().startsWith('//') && !line.trim().startsWith('*')
      );
      return lines.some((line: string) => /throw new/.test(line));
    });

    if (violations.length > 0) {
      console.error('Violations ADR-023 (throw dans repository):');
      violations.forEach((f: string) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  it('ADR-021 : chaque registerSingleton dans container.ts doit avoir un commentaire justificatif', () => {
    const containerPath = `${SRC}/infrastructure/di/container.ts`;
    const content = readFileSync(containerPath, 'utf-8');
    const lines = content.split('\n');

    const violations: number[] = [];
    lines.forEach((line: string, idx: number) => {
      if (line.includes('registerSingleton') && !line.trim().startsWith('//')) {
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

  it("ADR-019 : les interfaces d'events doivent avoir toutes les propriétés readonly", () => {
    const eventFiles = glob.sync(`${SRC}/contexts/**/events/**/*.ts`);
    const violations: string[] = [];

    eventFiles.forEach((file: string) => {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('extends DomainEvent')) {
        const lines = content.split('\n');
        lines.forEach((line: string, idx: number) => {
          if (
            /^\s+\w+\s*[?:]/.test(line) &&
            !line.trim().startsWith('readonly') &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push(`${path.relative(SRC, file)}:${idx + 1} — "${line.trim()}"`);
          }
        });
      }
    });

    if (violations.length > 0) {
      console.error('Propriétés non-readonly dans les events:');
      violations.forEach((v: string) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

  it('ADR-017 : pas de container.resolve() au niveau module (hors container.ts et hooks)', () => {
    const files = glob.sync(`${SRC}/**/*.ts`, {
      ignore: [
        `${SRC}/infrastructure/di/container.ts`,
        `${SRC}/**/hooks/**/*.ts`,
        `${SRC}/**/hooks.ts`,
        `${SRC}/config/bootstrap.ts`,
      ],
    });

    const violations = files.filter((file: string) => {
      const content = readFileSync(file, 'utf-8');
      return content.split('\n').some((line: string) =>
        /^(?![\s\/]).*container\.resolve/.test(line)
      );
    });

    if (violations.length > 0) {
      console.error('container.resolve() au niveau module:');
      violations.forEach((f: string) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  it('Tokens DI : tous les Symbol doivent utiliser Symbol.for() (pas Symbol())', () => {
    const tokensFile = `${SRC}/infrastructure/di/tokens.ts`;
    const content = readFileSync(tokensFile, 'utf-8');
    const violations = content.split('\n').filter((line: string) =>
      line.includes('Symbol(') && !line.includes('Symbol.for(') && !line.trim().startsWith('//')
    );

    expect(violations).toHaveLength(0);
  });

  it('ADR-022 : pas de @react-native-async-storage/async-storage dans le code source (OP-SQLite requis)', () => {
    const files = glob.sync(`${SRC}/**/*.ts`, {
      ignore: [
        `${SRC}/**/*.test.ts`,
        `${SRC}/**/*.spec.ts`,
        `${SRC}/**/__mocks__/**`,
        `${SRC}/**/mocks/**`,
      ],
    });

    const violations = files.filter((file: string) => {
      const content = readFileSync(file, 'utf-8');
      return content.includes('@react-native-async-storage/async-storage');
    });

    if (violations.length > 0) {
      console.error('Violations ADR-022 (AsyncStorage interdit — utiliser OP-SQLite):');
      violations.forEach((f: string) => console.error(' -', path.relative(SRC, f)));
    }
    expect(violations).toHaveLength(0);
  });

  it('ADR-028 : pas de "any" explicite dans le code source TypeScript', () => {
    const files = glob.sync(`${SRC}/**/*.ts`, {
      ignore: [
        `${SRC}/**/*.test.ts`,
        `${SRC}/**/*.spec.ts`,
        `${SRC}/**/__mocks__/**`,
        `${SRC}/**/mocks/**`,
        `${SRC}/**/*.d.ts`,
      ],
    });

    const violations: string[] = [];

    files.forEach((file: string) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line: string, idx: number) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Détecter : any, as any, <any> mais pas dans les génériques utilitaires (Record, etc.)
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
      violations.forEach((v: string) => console.error(' -', v));
    }
    expect(violations).toHaveLength(0);
  });

});
