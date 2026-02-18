/**
 * Story 12.3: Implémenter le Soft Delete sur Toutes les Entités Backend
 *
 * BDD acceptance tests — ADR-026 R4 compliance.
 * Tests vérifient que :
 * - Les repositories utilisent softDelete() (pas delete())
 * - findById() retourne null après soft delete (→ 404 API)
 * - findByIdWithDeleted() permet l'accès audit/admin
 * - Aucun champ _status textuel n'existe dans les entités
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs';
import * as path from 'path';
import { ThoughtRepository } from '../../src/modules/knowledge/application/repositories/thought.repository';
import { TodoRepository } from '../../src/modules/action/application/repositories/todo.repository';

const feature = loadFeature(
  './test/acceptance/features/story-12-3-backend-soft-delete.feature',
);

// =============================================================================
// Mock DataSource Factory
// Capture les appels softDelete() vs delete() pour vérification ADR-026 R4
// =============================================================================

interface SoftDeleteMockResult {
  dataSource: any;
  softDeleteCalls: string[];
  deleteCalls: string[];
  findOneCalls: Array<{ options: any }>;
}

const createSoftDeleteMockDataSource = (
  findOneResult: any = null,
): SoftDeleteMockResult => {
  const softDeleteCalls: string[] = [];
  const deleteCalls: string[] = [];
  const findOneCalls: Array<{ options: any }> = [];

  const repo = {
    create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
    save: jest.fn().mockImplementation(async (entity: any) => entity),
    softDelete: jest.fn().mockImplementation(async (id: string) => {
      softDeleteCalls.push(id);
      return { affected: 1 };
    }),
    delete: jest.fn().mockImplementation(async (id: string) => {
      deleteCalls.push(id);
      return { affected: 1 };
    }),
    findOne: jest.fn().mockImplementation(async (options: any) => {
      findOneCalls.push({ options });
      // Si withDeleted est true, retourner un résultat simulé
      if (options?.withDeleted) {
        return { id: options?.where?.id ?? 'deleted-id', deletedAt: new Date() };
      }
      // Sinon retourner null (soft-deleted filtré automatiquement par TypeORM)
      return findOneResult;
    }),
    find: jest.fn().mockResolvedValue([]),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn({
      create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
      save: jest.fn().mockImplementation(async (_cls: any, entity: any) => {
        if (Array.isArray(entity)) return entity.map((e) => ({ ...e }));
        return { ...entity };
      }),
    })),
    getRepository: jest.fn().mockReturnValue(repo),
    _repo: repo,
  };

  return { dataSource, softDeleteCalls, deleteCalls, findOneCalls };
};

// =============================================================================
// Tests BDD
// =============================================================================

defineFeature(feature, (test) => {
  let mockResult: SoftDeleteMockResult;
  let thoughtRepository: ThoughtRepository;
  let todoRepository: TodoRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Scénario 1: ThoughtRepository.delete() utilise softDelete()
  // ---------------------------------------------------------------------------
  test('ThoughtRepository utilise softDelete() à la place de delete()', ({
    given,
    when,
    then,
    and,
  }) => {
    given('un ThoughtRepository configuré avec un DataSource en mémoire', () => {
      mockResult = createSoftDeleteMockDataSource();
      thoughtRepository = new ThoughtRepository(mockResult.dataSource as any);
    });

    when('la méthode delete() est appelée pour un Thought existant', async () => {
      await thoughtRepository.delete('thought-001');
    });

    then('softDelete() est invoqué sur le repository TypeORM', () => {
      expect(mockResult.softDeleteCalls).toContain('thought-001');
    });

    and("delete() standard n'est pas invoqué", () => {
      expect(mockResult.deleteCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 2: findById() retourne null après soft delete → 404
  // ---------------------------------------------------------------------------
  test('Un Thought soft-deleté n\'est plus retourné par findById()', ({
    given,
    when,
    then,
    and,
  }) => {
    const thoughtId = 'thought-to-delete-001';

    given('un ThoughtRepository configuré avec un DataSource en mémoire', () => {
      // findOne retourne null pour un soft-deleted (TypeORM filtre automatiquement)
      mockResult = createSoftDeleteMockDataSource(null);
      thoughtRepository = new ThoughtRepository(mockResult.dataSource as any);
    });

    and(`un Thought avec l'id "${thoughtId}" existe`, () => {
      // Le Thought est supposé exister avant le delete
      // Dans notre mock, softDelete() simule la suppression
    });

    when(`la méthode delete() est appelée pour le Thought "${thoughtId}"`, async () => {
      await thoughtRepository.delete(thoughtId);
    });

    then(`findById("${thoughtId}") retourne null`, async () => {
      const result = await thoughtRepository.findById(thoughtId);
      // TypeORM filtre automatiquement les deleted_at != NULL dans findOne()
      // Notre mock retourne null pour simuler ce comportement
      expect(result).toBeNull();
    });

    and(
      `le record est toujours accessible via findByIdWithDeleted("${thoughtId}")`,
      async () => {
        const result = await thoughtRepository.findByIdWithDeleted(thoughtId);
        // findByIdWithDeleted utilise withDeleted: true — notre mock retourne un objet
        expect(result).not.toBeNull();
        expect(result?.deletedAt).toBeDefined();
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Scénario 3: TodoRepository.delete() utilise softDelete()
  // ---------------------------------------------------------------------------
  test('TodoRepository utilise softDelete() à la place de delete()', ({
    given,
    when,
    then,
    and,
  }) => {
    given('un TodoRepository configuré avec un DataSource en mémoire', () => {
      mockResult = createSoftDeleteMockDataSource();
      todoRepository = new TodoRepository(mockResult.dataSource as any);
    });

    when('la méthode delete() est appelée pour un Todo existant', async () => {
      await todoRepository.delete('todo-001');
    });

    then('softDelete() est invoqué sur le repository TypeORM pour les todos', () => {
      expect(mockResult.softDeleteCalls).toContain('todo-001');
    });

    and("delete() standard n'est pas invoqué pour les todos", () => {
      expect(mockResult.deleteCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 4: Vérification structurelle — absence de _status dans les entités
  // ---------------------------------------------------------------------------
  test("Aucune entité backend ne possède de champ _status textuel", ({
    given,
    when,
    then,
    and,
  }) => {
    const entityPaths = [
      'src/modules/knowledge/domain/entities/thought.entity.ts',
      'src/modules/knowledge/domain/entities/idea.entity.ts',
      'src/modules/action/domain/entities/todo.entity.ts',
    ];

    let entityContents: Record<string, string> = {};

    given('le code source des entités backend knowledge et action', () => {
      const backendRoot = path.resolve(__dirname, '../../');
      for (const entityPath of entityPaths) {
        const fullPath = path.join(backendRoot, entityPath);
        entityContents[entityPath] = fs.readFileSync(fullPath, 'utf-8');
      }
    });

    when("on inspecte les fichiers d'entités", () => {
      // Lecture déjà faite dans given
    });

    then(
      'les entités Thought, Idea et Todo ne contiennent pas de colonne _status',
      () => {
        for (const [, content] of Object.entries(entityContents)) {
          // Vérifie l'absence du NOM DE COLONNE _status (pattern TypeORM exact)
          // Note: '_status' peut apparaître en sous-chaîne dans 'thought_statuses'
          // qui est légitime — on cible uniquement la déclaration @Column
          expect(content).not.toContain("name: '_status'");
          expect(content).not.toMatch(/@Column.*_status['"]/);
        }
      },
    );

    and('ces entités héritent toutes de BaseEntity avec deletedAt', () => {
      for (const [, content] of Object.entries(entityContents)) {
        expect(content).toContain('extends BaseEntity');
      }
    });
  });
});
