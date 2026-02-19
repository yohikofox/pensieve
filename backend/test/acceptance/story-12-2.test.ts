/**
 * Story 12.2: Remplacer @PrimaryGeneratedColumn par UUID Généré dans le Domaine
 *
 * BDD acceptance tests — ADR-026 R1 compliance.
 * Tests vérifient que les UUIDs sont générés dans la couche applicative
 * (repositories) AVANT la persistance, pas par PostgreSQL DEFAULT.
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs';
import * as path from 'path';
import { ThoughtRepository } from '../../src/modules/knowledge/application/repositories/thought.repository';
import {
  TodoRepository,
  CreateTodoDto,
} from '../../src/modules/action/application/repositories/todo.repository';

const feature = loadFeature(
  './test/acceptance/features/story-12-2-backend-pk-domaine.feature',
);

/** Regex UUID v4 ou v7 — valide la version (4 ou 7) et le variant (8/9/a/b) */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// =============================================================================
// Mock DataSource Factory
// Capture les entités créées via manager.create() pour vérifier les UUIDs
// =============================================================================

interface MockDataSourceResult {
  dataSource: any;
  thoughtCreations: any[];
  ideaCreations: any[];
  todoCreations: any[];
}

const createMockDataSource = (): MockDataSourceResult => {
  const thoughtCreations: any[] = [];
  const ideaCreations: any[] = [];
  const todoCreations: any[] = [];

  const manager = {
    create: jest.fn().mockImplementation((EntityClass: any, data: any) => {
      const entity = { ...data };
      const className = EntityClass?.name ?? '';
      if (className === 'Thought') {
        thoughtCreations.push(entity);
      } else if (className === 'Idea') {
        ideaCreations.push(entity);
      } else if (className === 'Todo') {
        todoCreations.push(entity);
      }
      return entity;
    }),
    save: jest
      .fn()
      .mockImplementation(async (_EntityClass: any, entity: any) => {
        // Simuler save: retourne l'entité avec id si déjà défini
        if (Array.isArray(entity)) {
          return entity.map((e) => ({ ...e, id: e.id ?? 'db-generated-id' }));
        }
        return { ...entity, id: entity.id ?? 'db-generated-id' };
      }),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
    getRepository: jest.fn().mockReturnValue({
      create: manager.create,
      save: manager.save,
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({}),
    }),
    thoughtCreations,
    ideaCreations,
    todoCreations,
  };

  return { dataSource, thoughtCreations, ideaCreations, todoCreations };
};

// =============================================================================
// Tests BDD
// =============================================================================

defineFeature(feature, (test) => {
  // Context partagé par scénario
  let mockResult: MockDataSourceResult;
  let thoughtRepository: ThoughtRepository;
  let todoRepository: TodoRepository;

  beforeEach(() => {
    mockResult = createMockDataSource();
  });

  // ---------------------------------------------------------------------------
  // Scénario 1: UUID du Thought
  // ---------------------------------------------------------------------------
  test('Un Thought créé via le repository a un UUID assigné avant la persistance', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un ThoughtRepository configuré avec un DataSource en mémoire',
      () => {
        thoughtRepository = new ThoughtRepository(mockResult.dataSource);
      },
    );

    when(
      'une nouvelle capture est traitée avec captureId "capture-test-001" et résumé "Résumé de test"',
      async () => {
        await thoughtRepository.createWithIdeas(
          'capture-test-001',
          'user-001',
          'Résumé de test',
          ['Idée unique'],
          100,
        );
      },
    );

    then('le Thought créé a un identifiant UUID valide', () => {
      expect(mockResult.thoughtCreations).toHaveLength(1);
      const thoughtData = mockResult.thoughtCreations[0];
      expect(thoughtData.id).toBeDefined();
      expect(UUID_REGEX.test(thoughtData.id)).toBe(true);
    });

    and(
      "l'UUID est défini au moment du create(), avant la sauvegarde en base",
      () => {
        const thoughtData = mockResult.thoughtCreations[0];
        // Si l'UUID était généré par PostgreSQL, il serait undefined au moment du create()
        expect(thoughtData.id).not.toBeUndefined();
        expect(thoughtData.id).not.toBeNull();
        expect(typeof thoughtData.id).toBe('string');
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Scénario 2: UUIDs distincts pour les Ideas
  // ---------------------------------------------------------------------------
  test('Les Ideas créées avec un Thought ont chacune un UUID distinct assigné dans la couche applicative', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un ThoughtRepository configuré avec un DataSource en mémoire',
      () => {
        thoughtRepository = new ThoughtRepository(mockResult.dataSource);
      },
    );

    when(
      'une nouvelle capture est traitée avec 3 idées associées',
      async () => {
        await thoughtRepository.createWithIdeas(
          'capture-test-002',
          'user-001',
          'Résumé multi-idées',
          ['Idée A', 'Idée B', 'Idée C'],
          200,
        );
      },
    );

    then('chaque Idea a un UUID unique et valide', () => {
      expect(mockResult.ideaCreations).toHaveLength(3);
      for (const idea of mockResult.ideaCreations) {
        expect(idea.id).toBeDefined();
        expect(UUID_REGEX.test(idea.id)).toBe(true);
      }
    });

    and("les UUIDs des Ideas sont distincts de l'UUID du Thought", () => {
      const thoughtId = mockResult.thoughtCreations[0]?.id;
      const ideaIds = mockResult.ideaCreations.map((i) => i.id);

      // UUIDs des Ideas distincts de celui du Thought
      expect(ideaIds).not.toContain(thoughtId);
      // UUIDs des Ideas tous distincts entre eux
      const uniqueIds = new Set(ideaIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 3: UUIDs pour les Todos en transaction
  // ---------------------------------------------------------------------------
  test('Des Todos créés en transaction ont chacun un UUID assigné dans la couche applicative', ({
    given,
    when,
    then,
  }) => {
    given('un TodoRepository configuré avec un DataSource en mémoire', () => {
      todoRepository = new TodoRepository(mockResult.dataSource);
    });

    when(
      '2 Todos sont créés en transaction pour le thought "thought-uuid-000"',
      async () => {
        const manager = {
          create: mockResult.dataSource.getRepository().create,
          save: mockResult.dataSource.getRepository().save,
        };

        const dtos: CreateTodoDto[] = [
          {
            thoughtId: 'thought-uuid-000',
            captureId: 'capture-003',
            userId: 'user-001',
            description: 'Premier todo',
            priority: 'high',
          },
          {
            thoughtId: 'thought-uuid-000',
            captureId: 'capture-003',
            userId: 'user-001',
            description: 'Deuxième todo',
            priority: 'medium',
          },
        ];

        await todoRepository.createManyInTransaction(manager as any, dtos);
      },
    );

    then('chaque Todo a un UUID unique et valide', () => {
      expect(mockResult.todoCreations).toHaveLength(2);
      const todoIds = mockResult.todoCreations.map((t) => t.id);
      for (const id of todoIds) {
        expect(id).toBeDefined();
        expect(UUID_REGEX.test(id)).toBe(true);
      }
      // Les deux UUIDs doivent être distincts
      const uniqueIds = new Set(todoIds);
      expect(uniqueIds.size).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 4: Vérification structurelle — pas de @PrimaryGeneratedColumn
  // ---------------------------------------------------------------------------
  test("Aucune entité backend n'utilise @PrimaryGeneratedColumn", ({
    given,
    when,
    then,
    and,
  }) => {
    const entityPaths = [
      'src/modules/knowledge/domain/entities/thought.entity.ts',
      'src/modules/knowledge/domain/entities/idea.entity.ts',
      'src/modules/action/domain/entities/todo.entity.ts',
      'src/modules/capture/domain/entities/capture.entity.ts',
      'src/modules/capture/domain/entities/capture-state.entity.ts',
      'src/modules/capture/domain/entities/capture-type.entity.ts',
      'src/modules/capture/domain/entities/capture-sync-status.entity.ts',
    ];

    const entityContents: Record<string, string> = {};

    given('le code source des entités backend', () => {
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
      "les entités Thought, Idea, Todo, Capture, CaptureState, CaptureType et CaptureSyncStatus n'utilisent pas @PrimaryGeneratedColumn",
      () => {
        for (const [filePath, content] of Object.entries(entityContents)) {
          expect(content).not.toContain('@PrimaryGeneratedColumn');
        }
      },
    );

    and(
      'toutes ces entités héritent de BaseEntity ou BaseReferentialEntity',
      () => {
        for (const [filePath, content] of Object.entries(entityContents)) {
          // AppBaseEntity est le nom post-renommage (story 12.1 review fix)
          const extendsBaseEntity =
            content.includes('extends AppBaseEntity') ||
            content.includes('extends BaseEntity');
          const extendsBaseReferentialEntity = content.includes(
            'extends BaseReferentialEntity',
          );
          expect(extendsBaseEntity || extendsBaseReferentialEntity).toBe(true);
        }
      },
    );
  });
});
