/**
 * BDD Acceptance Tests — Story 8.15: Priorisation Visuelle des Tâches
 *
 * Valide :
 * - AC1: niveau "overdue" pour deadline dépassée
 * - AC2: niveau "prioritaire" pour priority=high
 * - AC3: niveau "approaching" pour deadline dans 24h
 * - AC4: niveau "normal" sans urgence
 * - AC5: toggle priority high ↔ medium via ITodoRepository.update()
 * - Précédences : overdue > prioritaire > approaching
 *
 * Stratégie : tests au niveau utilitaire (getUrgencyLevel) + repository mock
 * Pas de render React Native (jest-cucumber BDD pattern)
 */

jest.mock('@op-engineering/op-sqlite');

import 'reflect-metadata';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { Todo } from '../../src/contexts/action/domain/Todo.model';
import type { TodoSnapshot, TodoPriority } from '../../src/contexts/action/domain/Todo.model';
import { getUrgencyLevel, UrgencyLevel } from '../../src/contexts/action/utils/getUrgencyLevel';
import { TodoRepository } from '../../src/contexts/action/data/TodoRepository';
import { database } from '../../src/database';

const feature = loadFeature(
  'tests/acceptance/features/story-8-15-priorisation-visuelle-des-taches.feature',
);

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const mockSyncTrigger = {
  queueSync: jest.fn().mockReturnValue({ type: 'success', data: undefined }),
} as any;

function makeTodo(overrides: Partial<TodoSnapshot> = {}): Todo {
  return Todo.fromSnapshot({
    id: `todo-8-15-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    thoughtId: 'thought-test',
    ideaId: 'idea-test',
    captureId: 'capture-test',
    userId: 'user-test',
    description: 'Tâche test priorisation',
    status: 'todo',
    deadline: null,
    contact: null,
    priority: 'medium',
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
defineFeature(feature, (test) => {
  let testTodo: Todo;
  let computedUrgency: UrgencyLevel;
  let todoRepository: TodoRepository;

  beforeAll(() => {
    todoRepository = new TodoRepository(mockSyncTrigger);
    database.execute('PRAGMA foreign_keys = OFF');
  });

  beforeEach(() => {
    database.execute('DELETE FROM todos');
    jest.clearAllMocks();
  });

  afterAll(() => {
    database.execute('DELETE FROM todos');
  });

  // ── AC1 : En retard ─────────────────────────────────────────────────────────

  test('Tâche en retard affiche un niveau overdue', ({ given, when, then }) => {
    given('a todo exists with a deadline in the past', () => {
      testTodo = makeTodo({ deadline: Date.now() - ONE_DAY_MS });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "overdue"', () => {
      expect(computedUrgency).toBe('overdue');
    });
  });

  // ── AC2 : Prioritaire ───────────────────────────────────────────────────────

  test('Tâche prioritaire (priority=high) sans deadline affiche un niveau prioritaire', ({ given, when, then }) => {
    given('a todo exists with priority "high" and no deadline', () => {
      testTodo = makeTodo({ priority: 'high', deadline: null });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "prioritaire"', () => {
      expect(computedUrgency).toBe('prioritaire');
    });
  });

  // ── AC3 : Approchante ───────────────────────────────────────────────────────

  test('Tâche approchante (deadline dans 24h) affiche un niveau approaching', ({ given, when, then }) => {
    given('a todo exists with a deadline within 24 hours', () => {
      testTodo = makeTodo({ deadline: Date.now() + 24 * ONE_HOUR_MS });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "approaching"', () => {
      expect(computedUrgency).toBe('approaching');
    });
  });

  // ── AC4 : Normale ───────────────────────────────────────────────────────────

  test("Tâche normale n'a pas d'urgence particulière", ({ given, when, then }) => {
    given('a todo exists with priority "medium" and no deadline', () => {
      testTodo = makeTodo({ priority: 'medium', deadline: null });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "normal"', () => {
      expect(computedUrgency).toBe('normal');
    });
  });

  // ── Précédence overdue > prioritaire ────────────────────────────────────────

  test('Précédence overdue sur prioritaire', ({ given, when, then }) => {
    given('a todo exists with priority "high" and a deadline in the past', () => {
      testTodo = makeTodo({ priority: 'high', deadline: Date.now() - ONE_DAY_MS });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "overdue"', () => {
      expect(computedUrgency).toBe('overdue');
    });
  });

  // ── Précédence prioritaire > approaching ────────────────────────────────────

  test('Précédence prioritaire sur approaching', ({ given, when, then }) => {
    given('a todo exists with priority "high" and a deadline within 24 hours', () => {
      testTodo = makeTodo({ priority: 'high', deadline: Date.now() + 24 * ONE_HOUR_MS });
    });

    when('I compute the urgency level', () => {
      computedUrgency = getUrgencyLevel(testTodo);
    });

    then('the urgency level is "prioritaire"', () => {
      expect(computedUrgency).toBe('prioritaire');
    });
  });

  // ── AC5 : Toggle prioritaire medium → high ──────────────────────────────────

  test('Toggle prioritaire - medium devient high', ({ given, when, then }) => {
    let savedPriority: TodoPriority | undefined;

    given('a todo exists with priority "medium" and no deadline', async () => {
      testTodo = makeTodo({ id: 'todo-toggle-1', priority: 'medium', deadline: null });
      await todoRepository.create(testTodo);
    });

    when('I toggle the priority', async () => {
      const currentPriority = testTodo.priority;
      const newPriority: TodoPriority = currentPriority === 'high' ? 'medium' : 'high';
      await todoRepository.update(testTodo.id, { priority: newPriority });
      const updated = await todoRepository.findById(testTodo.id);
      savedPriority = updated?.priority;
    });

    then('the new priority is "high"', () => {
      expect(savedPriority).toBe('high');
    });
  });

  // ── AC5 : Toggle prioritaire high → medium ──────────────────────────────────

  test('Toggle prioritaire - high devient medium', ({ given, when, then }) => {
    let savedPriority: TodoPriority | undefined;

    given('a todo exists with priority "high" and no deadline', async () => {
      testTodo = makeTodo({ id: 'todo-toggle-2', priority: 'high', deadline: null });
      await todoRepository.create(testTodo);
    });

    when('I toggle the priority', async () => {
      const currentPriority = testTodo.priority;
      const newPriority: TodoPriority = currentPriority === 'high' ? 'medium' : 'high';
      await todoRepository.update(testTodo.id, { priority: newPriority });
      const updated = await todoRepository.findById(testTodo.id);
      savedPriority = updated?.priority;
    });

    then('the new priority is "medium"', () => {
      expect(savedPriority).toBe('medium');
    });
  });
});
