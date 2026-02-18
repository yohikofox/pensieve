/**
 * Story 12.4: Supprimer les Cascades TypeORM — ADR-026 R3
 *
 * BDD acceptance tests validant :
 * - AC2 : Les Ideas liées sont soft-deletées explicitement par le service
 * - AC3 : Transaction atomique avec rollback sur échec (Result Pattern)
 * - AC4 : Aucun cascade: true dans thought.entity.ts
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs';
import * as path from 'path';
import { ThoughtDeleteService } from '../../src/modules/knowledge/application/services/thought-delete.service';
import { isSuccess, isError } from '../../src/common/types/result.type';

const feature = loadFeature(
  './test/acceptance/features/story-12-4-backend-suppression-cascade.feature',
);

// =============================================================================
// Mock DataSource Factory
// =============================================================================

interface MockState {
  ideaSoftDeleteCalls: string[];
  thoughtSoftDeleteCalls: string[];
  shouldFailOnIdeaSoftDelete: boolean;
}

const createMockDataSource = (
  ideaIds: string[] = ['idea-001', 'idea-002'],
  state: Partial<MockState> = {},
) => {
  const mockState: MockState = {
    ideaSoftDeleteCalls: [],
    thoughtSoftDeleteCalls: [],
    shouldFailOnIdeaSoftDelete: false,
    ...state,
  };

  const ideaRepo = {
    find: jest
      .fn()
      .mockResolvedValue(
        ideaIds.map((id) => ({ id, thoughtId: 'thought-abc' })),
      ),
    softDelete: jest.fn().mockImplementation(async (ids: string[]) => {
      if (mockState.shouldFailOnIdeaSoftDelete) {
        throw new Error('Simulated Idea soft-delete failure');
      }
      mockState.ideaSoftDeleteCalls.push(...ids);
      return { affected: ids.length };
    }),
  };

  const thoughtRepo = {
    softDelete: jest.fn().mockImplementation(async (id: string) => {
      mockState.thoughtSoftDeleteCalls.push(id);
      return { affected: 1 };
    }),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => {
      const manager = {
        getRepository: jest.fn().mockImplementation((EntityClass: any) => {
          if (EntityClass.name === 'Idea') return ideaRepo;
          if (EntityClass.name === 'Thought') return thoughtRepo;
          throw new Error(`Unknown entity: ${EntityClass.name}`);
        }),
      };
      return await fn(manager);
    }),
    _state: mockState,
    _ideaRepo: ideaRepo,
    _thoughtRepo: thoughtRepo,
  };

  return dataSource;
};

// =============================================================================
// Tests BDD
// =============================================================================

defineFeature(feature, (test) => {
  let service: ThoughtDeleteService;
  let mockDataSource: ReturnType<typeof createMockDataSource>;
  let deletionResult: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Scénario 1: Les Ideas liées sont soft-deletées
  // ---------------------------------------------------------------------------
  test('Les Ideas liées sont soft-deletées quand un Thought est supprimé', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un ThoughtDeleteService configuré avec un DataSource en mémoire',
      () => {
        mockDataSource = createMockDataSource(['idea-001', 'idea-002']);
        service = new ThoughtDeleteService(mockDataSource as any);
      },
    );

    given(
      'un Thought "thought-abc" avec 2 Ideas liées "idea-001" et "idea-002"',
      () => {
        // Le mock DataSource déjà configuré retourne ces ideas
      },
    );

    when(
      'le ThoughtDeleteService supprime le Thought "thought-abc"',
      async () => {
        deletionResult = await service.softDeleteWithRelated('thought-abc');
      },
    );

    then('le résultat est un succès', () => {
      expect(isSuccess(deletionResult)).toBe(true);
    });

    and('les Ideas "idea-001" et "idea-002" sont soft-deletées', () => {
      expect(mockDataSource._state.ideaSoftDeleteCalls).toContain('idea-001');
      expect(mockDataSource._state.ideaSoftDeleteCalls).toContain('idea-002');
    });

    and('le Thought "thought-abc" est soft-deleted', () => {
      expect(mockDataSource._state.thoughtSoftDeleteCalls).toContain(
        'thought-abc',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 2: Rollback de transaction
  // ---------------------------------------------------------------------------
  test("Transaction rollback si le soft-delete d'une Idea échoue", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'un ThoughtDeleteService configuré avec un DataSource en mémoire',
      () => {
        mockDataSource = createMockDataSource(['idea-001'], {
          shouldFailOnIdeaSoftDelete: true,
        });
        service = new ThoughtDeleteService(mockDataSource as any);
      },
    );

    given('un Thought "thought-fail" avec des Ideas liées', () => {
      // Configuré dans le mock
    });

    and('le soft-delete des Ideas est configuré pour échouer', () => {
      // Configuré dans shouldFailOnIdeaSoftDelete: true
    });

    when(
      'le ThoughtDeleteService tente de supprimer le Thought "thought-fail"',
      async () => {
        deletionResult = await service.softDeleteWithRelated('thought-fail');
      },
    );

    then('le résultat est une erreur de transaction', () => {
      expect(isError(deletionResult)).toBe(true);
      expect(deletionResult.type).toBe('transaction_error');
    });

    and('le Thought "thought-fail" n\'est pas supprimé', () => {
      // La transaction a rollback — le Thought softDelete n'a pas été appelé
      expect(mockDataSource._state.thoughtSoftDeleteCalls).not.toContain(
        'thought-fail',
      );
    });

    and("aucune exception n'est levée", () => {
      // Le test lui-même n'a pas levé d'exception — Result Pattern respecté
      expect(deletionResult).toBeDefined();
      expect(deletionResult.type).toBe('transaction_error');
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 3: Vérification structurelle — absence de cascade: true
  // ---------------------------------------------------------------------------
  test("L'entité Thought ne contient plus de cascade TypeORM", ({
    given,
    when,
    then,
    and,
  }) => {
    let thoughtEntityContent: string;

    given(
      'un ThoughtDeleteService configuré avec un DataSource en mémoire',
      () => {
        // Non utilisé dans ce scénario de vérification structurelle
      },
    );

    given("le code source de l'entité Thought", () => {
      const entityPath = path.resolve(
        __dirname,
        '../../src/modules/knowledge/domain/entities/thought.entity.ts',
      );
      thoughtEntityContent = fs.readFileSync(entityPath, 'utf-8');
    });

    when('on inspecte la relation ideas', () => {
      // Lecture déjà faite dans given
    });

    then("la relation OneToMany n'a pas l'option cascade true", () => {
      expect(thoughtEntityContent).not.toContain('cascade: true');
    });

    and('un commentaire ADR-026 R3 documente la décision', () => {
      expect(thoughtEntityContent).toContain('ADR-026 R3');
    });
  });
});
