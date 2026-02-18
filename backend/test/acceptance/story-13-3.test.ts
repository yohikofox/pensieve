/**
 * Story 13.3: Corriger les Types de Colonnes Date vers TIMESTAMPTZ
 *
 * BDD acceptance tests — ADR-026 R5 compliance.
 * Tests vérifient que toutes les colonnes de date des entités backend
 * utilisent 'timestamptz' et non 'timestamp' sans timezone.
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs';
import * as path from 'path';

const feature = loadFeature(
  './test/acceptance/features/story-13-3-backend-timestamptz.feature',
);

const ENTITIES_SRC = path.resolve(__dirname, '../../src');

/**
 * Lit le contenu d'un fichier d'entité.
 */
const readEntityFile = (relativePath: string): string => {
  const fullPath = path.join(ENTITIES_SRC, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
};

/**
 * Vérifie qu'un contenu de fichier ne contient PAS de décorateur de date
 * avec type 'timestamp' (sans 'tz').
 *
 * Détecte les patterns:
 *   type: 'timestamp'   (violation)
 *   type: "timestamp"   (violation)
 *
 * Exclut:
 *   type: 'timestamptz' (correct)
 */
const containsTimestampWithoutTz = (content: string): boolean => {
  // Regex qui matche 'timestamp' mais PAS 'timestamptz'
  // \btimestamp\b assure que 'timestamptz' ne matche pas
  return /type:\s*['"]timestamp['"]\s*[,)]/m.test(content);
};

/**
 * Retourne les lignes contenant 'timestamp' sans timezone pour le débogage.
 */
const getViolatingLines = (content: string, filePath: string): string[] => {
  const lines = content.split('\n');
  const violations: string[] = [];
  lines.forEach((line, idx) => {
    if (/type:\s*['"]timestamp['"]\s*[,)]/m.test(line)) {
      violations.push(`  ${filePath}:${idx + 1}: ${line.trim()}`);
    }
  });
  return violations;
};

defineFeature(feature, (test) => {
  // ============================================================
  // Scenario 1: BaseEntity
  // ============================================================
  test('BaseEntity déclare ses colonnes de date en timestamptz', ({
    given,
    when,
    then,
    and,
  }) => {
    let content = '';

    given('le fichier source de BaseEntity', () => {
      content = readEntityFile('common/entities/base.entity.ts');
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      // already loaded
    });

    then("createdAt utilise le type 'timestamptz'", () => {
      expect(content).toMatch(
        /CreateDateColumn\s*\(\s*\{\s*type:\s*'timestamptz'/,
      );
    });

    and("updatedAt utilise le type 'timestamptz'", () => {
      expect(content).toMatch(
        /UpdateDateColumn\s*\(\s*\{\s*type:\s*'timestamptz'/,
      );
    });

    and("deletedAt utilise le type 'timestamptz'", () => {
      expect(content).toMatch(
        /DeleteDateColumn\s*\(\s*\{\s*type:\s*'timestamptz'/,
      );
    });
  });

  // ============================================================
  // Scenario 2: Todo entity
  // ============================================================
  test("L'entité Todo corrige ses colonnes de date spécifiques en timestamptz", ({
    given,
    when,
    then,
    and,
  }) => {
    let content = '';

    given("le fichier source de l'entité Todo", () => {
      content = readEntityFile('modules/action/domain/entities/todo.entity.ts');
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      // already loaded
    });

    then("la colonne deadline utilise le type 'timestamptz'", () => {
      // Vérifie que deadline utilise 'timestamptz' et non 'timestamp'
      const deadlineSection = content.match(/deadline[\s\S]{0,200}?@Column/m);
      // Reverse lookup: find the @Column before deadline
      const columnBeforeDeadline = content.match(
        /@Column\([^)]*type:\s*'(timestamp[^']*)'[^)]*\)\s*\n\s*deadline/,
      );
      expect(columnBeforeDeadline).not.toBeNull();
      expect(columnBeforeDeadline![1]).toBe('timestamptz');
    });

    and("la colonne completedAt utilise le type 'timestamptz'", () => {
      const columnBeforeCompletedAt = content.match(
        /@Column\([^)]*type:\s*'(timestamp[^']*)'[^)]*\)\s*\n\s*completedAt/,
      );
      expect(columnBeforeCompletedAt).not.toBeNull();
      expect(columnBeforeCompletedAt![1]).toBe('timestamptz');
    });
  });

  // ============================================================
  // Scenario 3: Notification entity
  // ============================================================
  test("L'entité Notification utilise timestamptz pour toutes ses colonnes de date", ({
    given,
    when,
    then,
  }) => {
    let content = '';
    let violations: string[] = [];

    given("le fichier source de l'entité Notification", () => {
      content = readEntityFile(
        'modules/notification/domain/entities/Notification.entity.ts',
      );
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      violations = getViolatingLines(
        content,
        'modules/notification/domain/entities/Notification.entity.ts',
      );
    });

    then(
      "aucune colonne de date n'utilise le type 'timestamp' sans timezone",
      () => {
        expect(violations).toEqual([]);
      },
    );
  });

  // ============================================================
  // Scenario 4: User entity
  // ============================================================
  test("L'entité User utilise timestamptz pour toutes ses colonnes de date", ({
    given,
    when,
    then,
  }) => {
    let content = '';
    let violations: string[] = [];

    given("le fichier source de l'entité User", () => {
      content = readEntityFile(
        'modules/shared/infrastructure/persistence/typeorm/entities/user.entity.ts',
      );
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      violations = getViolatingLines(
        content,
        'modules/shared/infrastructure/persistence/typeorm/entities/user.entity.ts',
      );
    });

    then(
      "aucune colonne de date n'utilise le type 'timestamp' sans timezone",
      () => {
        expect(violations).toEqual([]);
      },
    );
  });

  // ============================================================
  // Scenario 5: AdminUser entity
  // ============================================================
  test("L'entité AdminUser utilise timestamptz pour ses colonnes de date", ({
    given,
    when,
    then,
  }) => {
    let content = '';
    let violations: string[] = [];

    given("le fichier source de l'entité AdminUser", () => {
      content = readEntityFile(
        'modules/admin-auth/domain/entities/admin-user.entity.ts',
      );
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      violations = getViolatingLines(
        content,
        'modules/admin-auth/domain/entities/admin-user.entity.ts',
      );
    });

    then(
      "aucune colonne de date n'utilise le type 'timestamp' sans timezone",
      () => {
        expect(violations).toEqual([]);
      },
    );
  });

  // ============================================================
  // Scenario 6: Sync entities
  // ============================================================
  test('Les entités de synchronisation utilisent timestamptz', ({
    given,
    when,
    then,
  }) => {
    let allViolations: string[] = [];

    given('les fichiers sources de SyncLog et SyncConflict', () => {
      // loaded in 'when' step
    });

    when("j'inspecte les décorateurs de colonnes de date", () => {
      const syncLogContent = readEntityFile(
        'modules/sync/domain/entities/sync-log.entity.ts',
      );
      const syncConflictContent = readEntityFile(
        'modules/sync/domain/entities/sync-conflict.entity.ts',
      );
      allViolations = [
        ...getViolatingLines(syncLogContent, 'sync-log.entity.ts'),
        ...getViolatingLines(syncConflictContent, 'sync-conflict.entity.ts'),
      ];
    });

    then(
      "aucune colonne de date n'utilise le type 'timestamp' sans timezone",
      () => {
        expect(allViolations).toEqual([]);
      },
    );
  });

  // ============================================================
  // Scenario 7: Authorization entities
  // ============================================================
  test("Toutes les entités d'autorisation utilisent timestamptz", ({
    given,
    when,
    then,
  }) => {
    const allViolations: string[] = [];

    given("les fichiers sources des entités d'autorisation", () => {
      // loaded in 'when' step
    });

    when(
      "j'inspecte les décorateurs de colonnes de date dans chaque fichier",
      () => {
        const authEntityFiles = [
          'modules/authorization/implementations/postgresql/entities/role.entity.ts',
          'modules/authorization/implementations/postgresql/entities/permission.entity.ts',
          'modules/authorization/implementations/postgresql/entities/subscription-tier.entity.ts',
          'modules/authorization/implementations/postgresql/entities/user-role.entity.ts',
          'modules/authorization/implementations/postgresql/entities/user-permission.entity.ts',
          'modules/authorization/implementations/postgresql/entities/user-subscription.entity.ts',
          'modules/authorization/implementations/postgresql/entities/resource-share.entity.ts',
          'modules/authorization/implementations/postgresql/entities/role-permission.entity.ts',
          'modules/authorization/implementations/postgresql/entities/tier-permission.entity.ts',
          'modules/authorization/implementations/postgresql/entities/share-role.entity.ts',
          'modules/authorization/implementations/postgresql/entities/share-role-permission.entity.ts',
        ];

        authEntityFiles.forEach((filePath) => {
          const content = readEntityFile(filePath);
          allViolations.push(...getViolatingLines(content, filePath));
        });
      },
    );

    then(
      "aucun fichier d'entité d'autorisation n'utilise le type 'timestamp' sans timezone",
      () => {
        expect(allViolations).toEqual([]);
      },
    );
  });

  // ============================================================
  // Scenario 8: Migration exists
  // ============================================================
  test('La migration ALTER TABLE existe pour corriger les colonnes existantes', ({
    given,
    when,
    then,
    and,
  }) => {
    let migrationFiles: string[] = [];
    let migrationContent = '';

    given('le répertoire des migrations TypeORM', () => {
      const migrationsDir = path.join(ENTITIES_SRC, 'migrations');
      migrationFiles = fs.readdirSync(migrationsDir);
    });

    when('je cherche la migration de correction TIMESTAMPTZ', () => {
      const migrationFile = migrationFiles.find((f) =>
        f.includes('AlterTimestampColumnsToTimestamptz'),
      );
      if (migrationFile) {
        migrationContent = fs.readFileSync(
          path.join(ENTITIES_SRC, 'migrations', migrationFile),
          'utf-8',
        );
      }
    });

    then(
      'une migration nommée AlterTimestampColumnsToTimestamptz existe',
      () => {
        const found = migrationFiles.some((f) =>
          f.includes('AlterTimestampColumnsToTimestamptz'),
        );
        expect(found).toBe(true);
      },
    );

    and('elle contient des instructions ALTER COLUMN TYPE TIMESTAMPTZ', () => {
      expect(migrationContent).toMatch(/ALTER\s+COLUMN.*TYPE\s+TIMESTAMPTZ/i);
    });
  });

  // ============================================================
  // Scenario 9: No integer FKs in Capture entity (AC5)
  // ============================================================
  test('Les FKs entières résiduelles sont absentes de capture.entity.ts (AC5)', ({
    given,
    when,
    then,
    and,
  }) => {
    let content = '';

    given("le fichier source de l'entité Capture", () => {
      content = readEntityFile(
        'modules/capture/domain/entities/capture.entity.ts',
      );
    });

    when("j'inspecte les colonnes FK de type entier", () => {
      // already loaded
    });

    then('typeId est de type uuid et non number', () => {
      // Vérifie que typeId utilise type: 'uuid' et non number
      expect(content).toMatch(/typeId.*string/s);
      expect(content).not.toMatch(/typeId\?:\s*number/);
    });

    and('stateId est de type uuid et non number', () => {
      expect(content).toMatch(/stateId.*string/s);
      expect(content).not.toMatch(/stateId\?:\s*number/);
    });

    and('syncStatusId est de type uuid et non number', () => {
      expect(content).toMatch(/syncStatusId.*string/s);
      expect(content).not.toMatch(/syncStatusId!:\s*number/);
    });
  });
});
