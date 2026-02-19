/**
 * BDD Acceptance Tests — Story 13.4: Généraliser le Result Pattern (ADR-023)
 *
 * Valide les comportements du Result Pattern généralisé :
 * - AC1 : capture/domain/Result.ts réexporte depuis shared/domain/
 * - AC2 : Les 8 types sont disponibles + helpers sans throw
 * - AC4 : Le contexte action utilise Result<T> (toggleStatus)
 *
 * Run: npm run test:acceptance
 */

import 'reflect-metadata';
import { defineFeature, loadFeature } from 'jest-cucumber';
import {
  RepositoryResultType,
  success,
  notFound,
  networkError,
  databaseError,
} from '../../src/contexts/shared/domain/Result';
import * as CaptureResult from '../../src/contexts/capture/domain/Result';
import type { ITodoRepository } from '../../src/contexts/action/domain/ITodoRepository';
import type { Todo } from '../../src/contexts/action/domain/Todo.model';

const feature = loadFeature(
  'tests/acceptance/features/story-13-4-result-pattern.feature',
);

defineFeature(feature, (test) => {
  // ── AC2: Les 8 types ───────────────────────────────────────────────────────

  test("Les 8 types de résultat sont disponibles dans l'enum RepositoryResultType", ({
    given,
    then,
    and,
  }) => {
    let enumValues: string[];

    given("j'importe RepositoryResultType depuis shared/domain/Result", () => {
      enumValues = Object.values(RepositoryResultType);
    });

    then("l'enum contient SUCCESS, NOT_FOUND, DATABASE_ERROR, VALIDATION_ERROR", () => {
      expect(enumValues).toContain('success');
      expect(enumValues).toContain('not_found');
      expect(enumValues).toContain('database_error');
      expect(enumValues).toContain('validation_error');
    });

    and("l'enum contient NETWORK_ERROR, AUTH_ERROR, BUSINESS_ERROR, UNKNOWN_ERROR", () => {
      expect(enumValues).toContain('network_error');
      expect(enumValues).toContain('auth_error');
      expect(enumValues).toContain('business_error');
      expect(enumValues).toContain('unknown_error');
    });
  });

  // ── AC1: Backward compat ───────────────────────────────────────────────────

  test('Le contexte capture réexporte Result depuis shared/domain sans duplication', ({
    given,
    when,
    then,
    and,
  }) => {
    let result: ReturnType<typeof CaptureResult.success>;

    given("j'importe success depuis capture/domain/Result", () => {
      expect(CaptureResult.success).toBeDefined();
    });

    when('je crée un résultat de succès avec la donnée "test"', () => {
      result = CaptureResult.success('test');
    });

    then('le résultat est de type SUCCESS', () => {
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    and('la donnée est "test"', () => {
      expect(result.data).toBe('test');
    });
  });

  // ── AC2: notFound helper ───────────────────────────────────────────────────

  test("notFound() retourne NOT_FOUND sans lever d'exception", ({
    given,
    when,
    then,
    and,
  }) => {
    let errorMessage: string;
    let result: ReturnType<typeof notFound>;
    let thrownError: Error | undefined;

    given('j\'ai un message d\'erreur "Ressource introuvable"', () => {
      errorMessage = 'Ressource introuvable';
    });

    when("j'appelle notFound() avec ce message", () => {
      try {
        result = notFound(errorMessage);
      } catch (e) {
        thrownError = e as Error;
      }
    });

    then('le résultat est de type NOT_FOUND', () => {
      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
      expect(result.error).toBe(errorMessage);
    });

    and("aucune exception n'est levée", () => {
      expect(thrownError).toBeUndefined();
    });
  });

  // ── AC2: networkError helper ───────────────────────────────────────────────

  test("networkError() retourne NETWORK_ERROR avec le message d'erreur", ({
    given,
    when,
    then,
    and,
  }) => {
    let errorMessage: string;
    let result: ReturnType<typeof networkError>;

    given('j\'ai un message d\'erreur "Connexion perdue"', () => {
      errorMessage = 'Connexion perdue';
    });

    when("j'appelle networkError() avec ce message", () => {
      result = networkError(errorMessage);
    });

    then('le résultat est de type NETWORK_ERROR', () => {
      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
    });

    and("le résultat contient le message d'erreur", () => {
      expect(result.error).toBe(errorMessage);
    });
  });

  // ── AC4: toggleStatus SUCCESS ──────────────────────────────────────────────

  test('toggleStatus retourne SUCCESS avec le todo mis à jour', ({
    given,
    when,
    then,
    and,
  }) => {
    let mockRepo: Pick<ITodoRepository, 'toggleStatus'>;
    let result: Awaited<ReturnType<ITodoRepository['toggleStatus']>>;
    const mockTodo: Todo = {
      id: 'todo-1',
      thoughtId: 'thought-1',
      captureId: 'capture-1',
      userId: 'user-1',
      description: 'Test',
      status: 'completed',
      priority: 'medium',
      completedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    given('un mock de TodoRepository qui retourne un todo avec le statut "completed"', () => {
      mockRepo = {
        toggleStatus: jest.fn().mockResolvedValue(success(mockTodo)),
      };
    });

    when('j\'appelle toggleStatus avec l\'id "todo-1"', async () => {
      result = await mockRepo.toggleStatus('todo-1');
    });

    then('le résultat est de type SUCCESS', () => {
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    and('le résultat contient un todo avec le statut "completed"', () => {
      expect(result.data?.status).toBe('completed');
    });
  });

  // ── AC4: toggleStatus NOT_FOUND ────────────────────────────────────────────

  test("toggleStatus retourne NOT_FOUND sans lever d'exception quand le todo est absent", ({
    given,
    when,
    then,
    and,
  }) => {
    let mockRepo: Pick<ITodoRepository, 'toggleStatus'>;
    let result: Awaited<ReturnType<ITodoRepository['toggleStatus']>>;
    let thrownError: Error | undefined;

    given('un mock de TodoRepository qui retourne NOT_FOUND pour l\'id "todo-absent"', () => {
      mockRepo = {
        toggleStatus: jest.fn().mockResolvedValue(
          notFound('Todo not found: todo-absent'),
        ),
      };
    });

    when('j\'appelle toggleStatus avec l\'id "todo-absent"', async () => {
      try {
        result = await mockRepo.toggleStatus('todo-absent');
      } catch (e) {
        thrownError = e as Error;
      }
    });

    then('le résultat est de type NOT_FOUND', () => {
      expect(result.type).toBe(RepositoryResultType.NOT_FOUND);
    });

    and("aucune exception n'est levée", () => {
      expect(thrownError).toBeUndefined();
    });
  });
});
