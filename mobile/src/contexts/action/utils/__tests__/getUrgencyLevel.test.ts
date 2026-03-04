/**
 * Unit Tests — getUrgencyLevel()
 *
 * Story 8.15 — Subtask 1.3
 * Couvre AC1–AC4 + précédences overdue > prioritaire > approaching > normal
 */

import { getUrgencyLevel } from '../getUrgencyLevel';
import { Todo } from '../../domain/Todo.model';
import type { TodoSnapshot } from '../../domain/Todo.model';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const APPROACHING_THRESHOLD_MS = 48 * ONE_HOUR_MS;

function makeTodo(overrides: Partial<TodoSnapshot> = {}): Todo {
  return Todo.fromSnapshot({
    id: 'todo-test',
    thoughtId: 'thought-test',
    ideaId: 'idea-test',
    captureId: 'capture-test',
    userId: 'user-test',
    description: 'Tâche de test',
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

describe('getUrgencyLevel', () => {
  describe('AC4 — Tâche normale', () => {
    it('retourne "normal" pour medium priority sans deadline', () => {
      const todo = makeTodo({ priority: 'medium', deadline: null });
      expect(getUrgencyLevel(todo)).toBe('normal');
    });

    it('retourne "normal" pour low priority sans deadline', () => {
      const todo = makeTodo({ priority: 'low', deadline: null });
      expect(getUrgencyLevel(todo)).toBe('normal');
    });
  });

  describe('AC2 — Tâche prioritaire (orange)', () => {
    it('retourne "prioritaire" pour priority=high sans deadline', () => {
      const todo = makeTodo({ priority: 'high', deadline: null });
      expect(getUrgencyLevel(todo)).toBe('prioritaire');
    });

    it('retourne "prioritaire" pour priority=high avec deadline dans 5 jours', () => {
      const todo = makeTodo({
        priority: 'high',
        deadline: Date.now() + 5 * ONE_DAY_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('prioritaire');
    });
  });

  describe('AC3 — Tâche approchante (amber)', () => {
    it('retourne "approaching" pour deadline dans 24h et medium priority', () => {
      const todo = makeTodo({
        priority: 'medium',
        deadline: Date.now() + 24 * ONE_HOUR_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('approaching');
    });

    it('retourne "approaching" pour deadline dans exactement 48h', () => {
      const todo = makeTodo({
        priority: 'medium',
        deadline: Date.now() + APPROACHING_THRESHOLD_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('approaching');
    });

    it('retourne "normal" pour deadline dans 49h', () => {
      const todo = makeTodo({
        priority: 'medium',
        deadline: Date.now() + 49 * ONE_HOUR_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('normal');
    });
  });

  describe('AC1 — Tâche en retard (rouge)', () => {
    it('retourne "overdue" pour deadline hier (medium priority)', () => {
      const todo = makeTodo({
        priority: 'medium',
        deadline: Date.now() - ONE_DAY_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('overdue');
    });

    it('retourne "overdue" pour deadline il y a 5 jours', () => {
      const todo = makeTodo({
        priority: 'medium',
        deadline: Date.now() - 5 * ONE_DAY_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('overdue');
    });
  });

  describe('Précédences', () => {
    it('overdue > prioritaire — priority=high + deadline dépassée → "overdue"', () => {
      const todo = makeTodo({
        priority: 'high',
        deadline: Date.now() - ONE_DAY_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('overdue');
    });

    it('prioritaire > approaching — priority=high + deadline dans 24h → "prioritaire"', () => {
      const todo = makeTodo({
        priority: 'high',
        deadline: Date.now() + 24 * ONE_HOUR_MS,
      });
      expect(getUrgencyLevel(todo)).toBe('prioritaire');
    });
  });
});
