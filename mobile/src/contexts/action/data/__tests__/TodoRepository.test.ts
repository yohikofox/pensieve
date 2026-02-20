/**
 * TodoRepository Unit Tests
 *
 * Story 5.1 - Subtask 1.6: Add unit tests for TodoRepository
 * AC1, AC2, AC8: Test CRUD operations and sorting behavior
 */

import 'reflect-metadata'; // Required for TSyringe
import { open, type DB } from '@op-engineering/op-sqlite';
import { TodoRepository } from '../TodoRepository';
import { Todo, TodoStatus, TodoPriority } from '../../domain/Todo.model';
import { v4 as uuidv4 } from 'uuid';

describe('TodoRepository', () => {
  let db: DB;
  let repository: TodoRepository;

  // Test data
  const userId = uuidv4();
  const captureId = uuidv4();
  const thoughtId = uuidv4();
  const ideaId = uuidv4();

  beforeAll(() => {
    // Open in-memory database for testing
    db = open({ name: ':memory:' });

    // Enable foreign keys
    db.executeSync('PRAGMA foreign_keys = ON');

    // Create minimal schema (captures, thoughts, ideas, todos)
    db.executeSync(`
      CREATE TABLE captures (
        id TEXT PRIMARY KEY
      )
    `);

    db.executeSync(`
      CREATE TABLE thoughts (
        id TEXT PRIMARY KEY,
        capture_id TEXT NOT NULL,
        FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
      )
    `);

    db.executeSync(`
      CREATE TABLE ideas (
        id TEXT PRIMARY KEY,
        thought_id TEXT NOT NULL,
        FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE
      )
    `);

    db.executeSync(`
      CREATE TABLE todos (
        id TEXT PRIMARY KEY NOT NULL,
        thought_id TEXT NOT NULL,
        idea_id TEXT,
        capture_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('todo', 'completed', 'abandoned')) DEFAULT 'todo',
        description TEXT NOT NULL,
        deadline INTEGER,
        priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        _status TEXT NOT NULL DEFAULT 'active' CHECK(_status IN ('active', 'deleted')),
        FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE,
        FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE SET NULL,
        FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
      )
    `);

    // Insert test fixtures
    db.executeSync('INSERT INTO captures (id) VALUES (?)', [captureId]);
    db.executeSync('INSERT INTO thoughts (id, capture_id) VALUES (?, ?)', [thoughtId, captureId]);
    db.executeSync('INSERT INTO ideas (id, thought_id) VALUES (?, ?)', [ideaId, thoughtId]);

    // Create repository instance
    repository = new TodoRepository(db);
  });

  afterAll(() => {
    // OP-SQLite in-memory database doesn't need explicit close
    // db.close() is not available in OP-SQLite
  });

  beforeEach(() => {
    // Clear todos table before each test
    db.executeSync('DELETE FROM todos');
  });

  describe('create', () => {
    it('should create a new todo successfully', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Test todo',
        status: 'todo',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      // Verify todo was created
      const found = await repository.findById(todo.id);
      expect(found).not.toBeNull();
      expect(found?.description).toBe('Test todo');
      expect(found?.status).toBe('todo');
    });

    it('should create a todo with optional fields (deadline, completedAt)', async () => {
      const deadline = Date.now() + 86400000; // +1 day
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Test todo with deadline',
        status: 'todo',
        deadline,
        priority: 'high',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      const found = await repository.findById(todo.id);
      expect(found?.deadline).toBe(deadline);
    });
  });

  describe('findById', () => {
    it('should return null if todo not found', async () => {
      const result = await repository.findById(uuidv4());
      expect(result).toBeNull();
    });

    it('should find existing todo by ID', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Find me',
        status: 'todo',
        priority: 'low',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      const found = await repository.findById(todo.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(todo.id);
      expect(found?.description).toBe('Find me');
    });
  });

  describe('findByIdeaId', () => {
    it('should return empty array if no todos for idea', async () => {
      const emptyIdeaId = uuidv4();
      const result = await repository.findByIdeaId(emptyIdeaId);
      expect(result).toEqual([]);
    });

    it('should return todos sorted by status (active first) then priority (high → medium → low)', async () => {
      // Create todos with different priorities and statuses
      const todos: Todo[] = [
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'Low priority active',
          status: 'todo',
          priority: 'low',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'High priority active',
          status: 'todo',
          priority: 'high',
          createdAt: Date.now() + 1,
          updatedAt: Date.now() + 1,
        },
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'Medium priority completed',
          status: 'completed',
          priority: 'medium',
          completedAt: Date.now(),
          createdAt: Date.now() + 2,
          updatedAt: Date.now() + 2,
        },
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'Medium priority active',
          status: 'todo',
          priority: 'medium',
          createdAt: Date.now() + 3,
          updatedAt: Date.now() + 3,
        },
      ];

      for (const todo of todos) {
        await repository.create(todo);
      }

      const result = await repository.findByIdeaId(ideaId);

      // AC2: Verify sorting order (active first, then by priority)
      expect(result).toHaveLength(4);
      expect(result[0].description).toBe('High priority active');
      expect(result[1].description).toBe('Medium priority active');
      expect(result[2].description).toBe('Low priority active');
      expect(result[3].description).toBe('Medium priority completed');
    });
  });

  describe('update', () => {
    it('should update todo description', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Original description',
        status: 'todo',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      await repository.update(todo.id, { description: 'Updated description' });

      const updated = await repository.findById(todo.id);
      expect(updated?.description).toBe('Updated description');
    });

    it('should update todo priority and deadline', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Test',
        status: 'todo',
        priority: 'low',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      const newDeadline = Date.now() + 86400000; // +1 day
      await repository.update(todo.id, { priority: 'high', deadline: newDeadline });

      const updated = await repository.findById(todo.id);
      expect(updated?.priority).toBe('high');
      expect(updated?.deadline).toBe(newDeadline);
    });
  });

  describe('toggleStatus', () => {
    it('should toggle status from todo to completed (AC8)', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Toggle me',
        status: 'todo',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      const toggled = await repository.toggleStatus(todo.id);

      expect(toggled.status).toBe('completed');
      expect(toggled.completedAt).toBeDefined();
      expect(toggled.completedAt).toBeGreaterThan(0);
    });

    it('should toggle status from completed to todo', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Toggle back',
        status: 'completed',
        priority: 'medium',
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      const toggled = await repository.toggleStatus(todo.id);

      expect(toggled.status).toBe('todo');
      expect(toggled.completedAt).toBeUndefined();
    });

    it('should throw error if todo not found', async () => {
      await expect(repository.toggleStatus(uuidv4())).rejects.toThrow('Todo not found');
    });
  });

  describe('delete', () => {
    it('should delete existing todo', async () => {
      const todo: Todo = {
        id: uuidv4(),
        thoughtId,
        ideaId,
        captureId,
        userId,
        description: 'Delete me',
        status: 'todo',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.create(todo);

      await repository.delete(todo.id);

      const found = await repository.findById(todo.id);
      expect(found).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all todos ordered by creation date (descending)', async () => {
      const todos: Todo[] = [
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'First',
          status: 'todo',
          priority: 'medium',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: uuidv4(),
          thoughtId,
          ideaId,
          captureId,
          userId,
          description: 'Second',
          status: 'todo',
          priority: 'medium',
          createdAt: Date.now() + 1000,
          updatedAt: Date.now() + 1000,
        },
      ];

      for (const todo of todos) {
        await repository.create(todo);
      }

      const all = await repository.getAll();

      expect(all).toHaveLength(2);
      expect(all[0].description).toBe('Second'); // Most recent first
      expect(all[1].description).toBe('First');
    });
  });
});
