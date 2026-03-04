/**
 * Story 8.13 — Supprimer une Tâche
 * BDD Acceptance Tests — jest-cucumber
 *
 * Valide le comportement de suppression définitive (hard delete) d'une tâche :
 * - AC2 : Confirmation avant suppression / annulation
 * - AC3 : Suppression effective (hard delete OP-SQLite)
 * - AC4 : Bouton supprimer dans la vue détail
 * - AC5 : Non-régression corbeille (soft-deleted todos non affectés)
 *
 * Pattern :
 * - jest.mock('@op-engineering/op-sqlite') → utilise le mock better-sqlite3 en mémoire
 * - TodoRepository instancié directement (sans DI, SyncTrigger mocké)
 * - Tests au niveau repository (logique métier), interactions UI testées manuellement
 */

jest.mock('@op-engineering/op-sqlite');

import 'reflect-metadata';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { TodoRepository } from '../../src/contexts/action/data/TodoRepository';
import type { ITodoRepository } from '../../src/contexts/action/domain/ITodoRepository';
import type { Todo } from '../../src/contexts/action/domain/Todo.model';
import { database } from '../../src/database';

const feature = loadFeature(
  'tests/acceptance/features/story-8-13-supprimer-une-tache.feature',
);

// ─────────────────────────────────────────────────────────────────────────────
// Mock SyncTrigger (delete() ne l'utilise pas, mais le constructeur l'exige)
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
  let softDeletedTodo: Todo;

  beforeAll(() => {
    todoRepository = new TodoRepository(mockSyncTrigger);
    // Tests repository uniquement — désactiver les FK pour éviter les dépendances
    // sur captures/thoughts qui ne font pas partie du sujet de ces tests.
    database.execute('PRAGMA foreign_keys = OFF');
  });

  beforeEach(async () => {
    // Nettoyer tous les todos entre les scénarios
    database.execute('DELETE FROM todos');
    testTodo = makeTodo({ id: 'todo-main', description: 'Appeler le client' });
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

    and('une tâche "Appeler le client" existe dans la base de données locale', async () => {
      await todoRepository.create(testTodo);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 1 : Suppression via vue détail → todo absent de la DB (AC4, AC2, AC3)
  // ──────────────────────────────────────────────────────────────────────────
  test('Suppression via la vue détail — la tâche disparaît de la DB (AC4, AC2, AC3)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" est présente dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
    });

    when("l'utilisateur confirme la suppression depuis la vue détail", async () => {
      // Simule le onPress: 'Supprimer' du Alert.alert dans handleDelete()
      await todoRepository.delete(testTodo.id);
    });

    then('la tâche "Appeler le client" est absente de la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 2 : Annulation → la tâche reste présente (AC2)
  // ──────────────────────────────────────────────────────────────────────────
  test("Annulation depuis la vue détail — la tâche reste présente (AC2)", ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" est présente dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
    });

    when("l'utilisateur annule la suppression depuis la vue détail", () => {
      // Simule le onPress: 'Annuler' → aucune action sur le repository
      // (la suppression n'est PAS appelée)
    });

    then('la tâche "Appeler le client" est toujours présente dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(testTodo.id);
      expect(found!.description).toBe('Appeler le client');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 3 : Swipe gauche + confirmation → suppression définitive (AC1, AC3)
  // ──────────────────────────────────────────────────────────────────────────
  test('Suppression via swipe — la tâche est définitivement supprimée (AC1, AC3)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('la tâche "Appeler le client" est présente dans la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).not.toBeNull();
    });

    when("l'utilisateur effectue un swipe gauche et confirme la suppression", async () => {
      // Simule le onPress: 'Supprimer' du Alert.alert déclenché par le swipe
      await todoRepository.delete(testTodo.id);
    });

    then('la tâche "Appeler le client" est absente de la base de données', async () => {
      const found = await todoRepository.findById(testTodo.id);
      expect(found).toBeNull();
    });

    and('les compteurs de tâches sont mis à jour automatiquement', async () => {
      // Vérifie que countByStatus ne compte plus la tâche supprimée
      const activeCount = await todoRepository.countByStatus('todo');
      // La tâche avait status = 'todo', elle ne doit plus être comptée
      const initialActiveCount = 0; // tous les todos ont été supprimés
      expect(activeCount).toBe(initialActiveCount);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 4 : Non-régression corbeille (AC5)
  // ──────────────────────────────────────────────────────────────────────────
  test('Non-régression corbeille — les tâches soft-deleted ne sont pas affectées (AC5)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given, and);

    given('une tâche "Tâche générée par IA" avec statut soft-deleted existe dans la base de données', async () => {
      // Insérer un todo avec _status = 'deleted' (soft-delete, simulant le sync PULL)
      softDeletedTodo = makeTodo({
        id: 'todo-soft-deleted',
        description: 'Tâche générée par IA',
      });
      await todoRepository.create(softDeletedTodo);
      // Simuler un soft-delete : _status = 'deleted' (comme ferait le sync PULL)
      database.execute("UPDATE todos SET _status = 'deleted' WHERE id = ?", [softDeletedTodo.id]);
    });

    when("l'utilisateur supprime définitivement la tâche \"Appeler le client\"", async () => {
      await todoRepository.delete(testTodo.id);
    });

    then('la tâche "Tâche générée par IA" soft-deleted est toujours présente dans la base de données', async () => {
      // findById ne filtre pas sur _status, donc le todo soft-deleted est accessible
      const found = await todoRepository.findById(softDeletedTodo.id);
      expect(found).not.toBeNull();
    });

    and('la tâche "Tâche générée par IA" soft-deleted a toujours le statut "deleted"', async () => {
      // Vérifier que findAllDeletedWithSource retourne encore ce todo
      const deletedTodos = await todoRepository.findAllDeletedWithSource();
      const foundInTrash = deletedTodos.some((t) => t.id === softDeletedTodo.id);
      expect(foundInTrash).toBe(true);
    });
  });
});
