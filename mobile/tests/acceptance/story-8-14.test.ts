/**
 * Story 8.14 — Abandonner une Tâche
 * BDD Acceptance Tests — jest-cucumber
 *
 * Valide le comportement d'abandon d'une tâche (soft state) :
 * - AC1 : Abandon via swipe → status = 'abandoned'
 * - AC3 : Abandon depuis la vue détail → status = 'abandoned'
 * - AC4 : Filtre "Abandonnées" affiche uniquement les tâches abandonnées
 * - AC5 : Réactivation d'une tâche abandonnée → status = 'todo'
 *
 * Pattern :
 * - jest.mock('@op-engineering/op-sqlite') → utilise le mock better-sqlite3 en mémoire
 * - TodoRepository instancié directement (sans DI, SyncTrigger mocké)
 * - Tests au niveau repository (logique métier)
 */

jest.mock('@op-engineering/op-sqlite');

import 'reflect-metadata';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { TodoRepository } from '../../src/contexts/action/data/TodoRepository';
import type { ITodoRepository } from '../../src/contexts/action/domain/ITodoRepository';
import type { Todo } from '../../src/contexts/action/domain/Todo.model';
import { database } from '../../src/database';
import { filterTodos } from '../../src/contexts/action/utils/filterTodos';

const feature = loadFeature(
  'tests/acceptance/features/story-8-14-abandonner-une-tache.feature',
);

// ─────────────────────────────────────────────────────────────────────────────
// Mock SyncTrigger
// ─────────────────────────────────────────────────────────────────────────────
const mockSyncTrigger = {
  queueSync: jest.fn().mockReturnValue({ type: 'success', data: undefined }),
} as any;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: `todo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    thoughtId: 'thought-test',
    ideaId: 'idea-test',
    captureId: 'capture-test',
    userId: 'user-test',
    description: 'Appeler le client',
    status: 'todo',
    priority: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
defineFeature(feature, (test) => {
  let todoRepository: ITodoRepository;
  let testTodo: Todo;

  beforeAll(() => {
    todoRepository = new TodoRepository(mockSyncTrigger);
    database.execute('PRAGMA foreign_keys = OFF');
  });

  beforeEach(async () => {
    database.execute('DELETE FROM todos');
    testTodo = makeTodo({ id: 'todo-main', description: 'Appeler le client', status: 'todo' });
  });

  afterAll(() => {
    database.execute('DELETE FROM todos');
    database.execute('PRAGMA foreign_keys = ON');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Background steps
  // ──────────────────────────────────────────────────────────────────────────

  function defineBackground(
    given: (stepText: string, fn: () => void | Promise<void>) => void,
    and: (stepText: string, fn: () => void | Promise<void>) => void,
  ) {
    given('le dépôt de tâches est initialisé', () => {
      // todoRepository est instancié dans beforeAll
    });

    and('une tâche "Appeler le client" avec le statut "todo" existe dans la base de données', async () => {
      await todoRepository.create(testTodo);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 1 : Abandon via vue détail → status = 'abandoned' (AC3)
  // ──────────────────────────────────────────────────────────────────────────
  test('Abandon via la vue détail — le statut passe à "abandoned" (AC3)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" a le statut "todo"', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.status).toBe('todo');
    });

    when("l'utilisateur abandonne la tâche depuis la vue détail", async () => {
      // Simule l'appel de useAbandonTodo.mutate → todoRepository.update(id, { status: 'abandoned' })
      const result = await todoRepository.update(testTodo.id, {
        status: 'abandoned',
        updatedAt: Date.now(),
      });
      expect(result).toBe(true);
    });

    then('la tâche "Appeler le client" a le statut "abandoned" dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.status).toBe('abandoned');
    });

    and('la tâche "Appeler le client" est toujours présente dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(testTodo.id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 2 : Réactivation → status = 'todo' (AC5)
  // ──────────────────────────────────────────────────────────────────────────
  test('Réactivation depuis la vue détail — le statut revient à "todo" (AC5)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" a le statut "abandoned"', async () => {
      await todoRepository.update(testTodo.id, {
        status: 'abandoned',
        updatedAt: Date.now(),
      });
      const found = await todoRepository.findById(testTodo.id);
      expect(found!.status).toBe('abandoned');
    });

    when("l'utilisateur réactive la tâche depuis la vue détail", async () => {
      // Simule l'appel de useReactivateTodo.mutate → todoRepository.update(id, { status: 'todo' })
      const result = await todoRepository.update(testTodo.id, {
        status: 'todo',
        updatedAt: Date.now(),
      });
      expect(result).toBe(true);
    });

    then('la tâche "Appeler le client" a le statut "todo" dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.status).toBe('todo');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 3 : Abandon via swipe → status = 'abandoned' (AC1)
  // ──────────────────────────────────────────────────────────────────────────
  test('Abandon via swipe — le statut passe à "abandoned" (AC1)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" a le statut "todo"', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found!.status).toBe('todo');
    });

    when('l\'utilisateur effectue un swipe gauche et tape "Abandonner"', async () => {
      // Simule le onPress du bouton Abandonner dans renderRightActions
      const result = await todoRepository.update(testTodo.id, {
        status: 'abandoned',
        updatedAt: Date.now(),
      });
      expect(result).toBe(true);
    });

    then('la tâche "Appeler le client" a le statut "abandoned" dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found!.status).toBe('abandoned');
    });

    and('la tâche n\'est pas supprimée de la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(testTodo.id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 4 : Filtre "Abandonnées" (AC4)
  // ──────────────────────────────────────────────────────────────────────────
  test('Filtre "Abandonnées" affiche uniquement les tâches abandonnées (AC4)', ({
    given,
    when,
    then,
    and,
  }) => {
    let rapportTodo: Todo;
    let emailTodo: Todo;
    let allTodos: Todo[];

    defineBackground(given, and);

    given('une tâche "Préparer le rapport" avec le statut "todo" existe dans la base de données', async () => {
      rapportTodo = makeTodo({
        id: 'todo-rapport',
        description: 'Préparer le rapport',
        status: 'todo',
      });
      await todoRepository.create(rapportTodo);
    });

    and('une tâche "Envoyer email" avec le statut "abandoned" existe dans la base de données', async () => {
      emailTodo = makeTodo({
        id: 'todo-email',
        description: 'Envoyer email',
        status: 'abandoned',
      });
      await todoRepository.create(emailTodo);
    });

    when('l\'utilisateur sélectionne le filtre "Abandonnées"', async () => {
      allTodos = await todoRepository.findAll();
      // Inclure aussi les todos avec status 'abandoned' dans findAll (elles ont _status = 'active')
      // On simule le client-side filtering
    });

    then('seule la tâche "Envoyer email" est visible dans la liste filtrée', () => {
      const filtered = filterTodos(allTodos, 'abandoned');
      const descriptions = filtered.map((t) => t.description);
      expect(descriptions).toContain('Envoyer email');
      expect(filtered).toHaveLength(1);
    });

    and('la tâche "Préparer le rapport" n\'est pas visible dans la liste filtrée', () => {
      const filtered = filterTodos(allTodos, 'abandoned');
      const descriptions = filtered.map((t) => t.description);
      expect(descriptions).not.toContain('Préparer le rapport');
    });

    and('la tâche "Appeler le client" n\'est pas visible dans la liste filtrée', () => {
      const filtered = filterTodos(allTodos, 'abandoned');
      const descriptions = filtered.map((t) => t.description);
      expect(descriptions).not.toContain('Appeler le client');
    });
  });
});
