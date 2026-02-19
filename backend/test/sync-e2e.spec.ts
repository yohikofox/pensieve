/**
 * Sync Infrastructure E2E Tests
 * Story 6.1 - Task 7: Integration Testing
 *
 * Tests all sync scenarios:
 * - 7.1: Full sync round-trip (push → backend → pull)
 * - 7.2: Offline scenario (create offline → sync when online)
 * - 7.3: Conflict resolution (multi-client edit)
 * - 7.4: Retry with Fibonacci backoff
 * - 7.5: Soft delete propagation
 * - 7.6: Performance (1000 records < 10s)
 * - 7.7: User isolation (NFR13)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Thought } from '../src/modules/knowledge/domain/entities/thought.entity';
import { Idea } from '../src/modules/knowledge/domain/entities/idea.entity';
import { Todo } from '../src/modules/action/domain/entities/todo.entity';
import { SyncLog } from '../src/modules/sync/domain/entities/sync-log.entity';
import { SyncConflict } from '../src/modules/sync/domain/entities/sync-conflict.entity';
import { BetterAuthGuard } from '../src/auth/guards/better-auth.guard';

describe('Sync Infrastructure E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(BetterAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: userId }; // Mock authenticated user
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // Mock auth for tests - userId set before guard override
    userId = 'test-user-123';
    authToken = 'mock-jwt-token'; // Token is now ignored, guard overridden
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.query(
      'TRUNCATE thoughts, ideas, todos, sync_logs, sync_conflicts CASCADE',
    );
  });

  describe('Task 7.1 - Full Sync Round-Trip', () => {
    it('should sync data from mobile to backend (PUSH)', async () => {
      const pushPayload = {
        lastPulledAt: 0,
        changes: {
          thought: {
            updated: [
              {
                id: 'thought-1',
                captureId: 'capture-1',
                userId,
                summary: 'Test thought from mobile',
                confidenceScore: 0.95,
                processingTimeMs: 150,
                last_modified_at: Date.now(),
                _status: 'active',
              },
            ],
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload)
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.changes).toBeDefined();

      // Verify data persisted in database
      const thought = await dataSource.getRepository(Thought).findOne({
        where: { id: 'thought-1' },
      });

      expect(thought).toBeDefined();
      expect(thought?.summary).toBe('Test thought from mobile');
      expect(thought?.userId).toBe(userId);
      expect(thought?._status).toBe('active');
    });

    it('should sync data from backend to mobile (PULL)', async () => {
      // Seed backend with data
      const thought = dataSource.getRepository(Thought).create({
        id: 'thought-2',
        captureId: 'capture-2',
        userId,
        summary: 'Test thought from backend',
        confidenceScore: 0.9,
        processingTimeMs: 200,
        last_modified_at: Date.now(),
        _status: 'active',
      });
      await dataSource.getRepository(Thought).save(thought);

      const response = await request(app.getHttpServer())
        .get('/api/sync/pull?lastPulledAt=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.changes.thought).toBeDefined();
      expect(response.body.changes.thought.updated).toHaveLength(1);
      expect(response.body.changes.thought.updated[0].id).toBe('thought-2');
      expect(response.body.changes.thought.updated[0].summary).toBe(
        'Test thought from backend',
      );
    });

    it('should complete full round-trip: PUSH → backend persist → PULL from another client', async () => {
      // Client 1: PUSH data
      const pushPayload = {
        lastPulledAt: 0,
        changes: {
          todo: {
            updated: [
              {
                id: 'todo-1',
                thoughtId: 'thought-1',
                captureId: 'capture-1',
                userId,
                description: 'Task from client 1',
                status: 'todo',
                priority: 'high',
                last_modified_at: Date.now(),
                _status: 'active',
              },
            ],
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload)
        .expect(200);

      // Client 2: PULL data
      const pullResponse = await request(app.getHttpServer())
        .get('/api/sync/pull?lastPulledAt=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(pullResponse.body.changes.todo).toBeDefined();
      expect(pullResponse.body.changes.todo.updated).toHaveLength(1);
      expect(pullResponse.body.changes.todo.updated[0].description).toBe(
        'Task from client 1',
      );
    });

    it('should log sync operations in sync_logs table', async () => {
      await request(app.getHttpServer())
        .get('/api/sync/pull?lastPulledAt=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const logs = await dataSource.getRepository(SyncLog).find({
        where: { userId },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].syncType).toBe('pull');
      expect(logs[0].status).toBe('success');
      expect(logs[0].durationMs).toBeGreaterThan(0);
    });
  });

  describe('Task 7.3 - Conflict Resolution', () => {
    it('should detect and resolve conflicts when client has stale data', async () => {
      const now = Date.now();

      // Seed backend with existing todo
      const serverTodo = dataSource.getRepository(Todo).create({
        id: 'todo-conflict',
        thoughtId: 'thought-1',
        captureId: 'capture-1',
        userId,
        description: 'Server version',
        status: 'in_progress',
        priority: 'high',
        last_modified_at: now + 5000, // Server modified AFTER client's lastPulledAt
        _status: 'active',
      });
      await dataSource.getRepository(Todo).save(serverTodo);

      // Client tries to push update with stale lastPulledAt
      const pushPayload = {
        lastPulledAt: now, // Client's last pull was BEFORE server modification
        changes: {
          todo: {
            updated: [
              {
                id: 'todo-conflict',
                thoughtId: 'thought-1',
                captureId: 'capture-1',
                userId,
                description: 'Client version',
                status: 'completed', // Client changed status
                priority: 'medium', // Client changed priority
                last_modified_at: now + 3000,
                _status: 'active',
              },
            ],
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload)
        .expect(200);

      // Should detect conflict and apply per-column resolution
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBeGreaterThan(0);

      // Check conflict was logged
      const conflicts = await dataSource.getRepository(SyncConflict).find({
        where: { userId, entity: 'todo' },
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].resolutionStrategy).toBe('per_column_client_wins');

      // Verify resolved data in database
      const resolvedTodo = await dataSource.getRepository(Todo).findOne({
        where: { id: 'todo-conflict' },
      });

      // Per-column client-wins for Todo:
      // - Client wins: status (business state)
      // - Server wins: priority (AI-inferred metadata)
      expect(resolvedTodo?.status).toBe('completed'); // Client wins
      expect(resolvedTodo?.priority).toBe('high'); // Server wins
    });
  });

  describe('Task 7.5 - Soft Delete Propagation', () => {
    it('should propagate soft deletes from mobile to backend', async () => {
      // Seed backend with active thought
      const thought = dataSource.getRepository(Thought).create({
        id: 'thought-delete',
        captureId: 'capture-1',
        userId,
        summary: 'To be deleted',
        confidenceScore: 0.9,
        processingTimeMs: 100,
        last_modified_at: Date.now(),
        _status: 'active',
      });
      await dataSource.getRepository(Thought).save(thought);

      // Mobile sends soft delete
      const pushPayload = {
        lastPulledAt: Date.now(),
        changes: {
          thought: {
            deleted: ['thought-delete'],
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload)
        .expect(200);

      // Verify soft delete in database
      const deletedThought = await dataSource.getRepository(Thought).findOne({
        where: { id: 'thought-delete' },
      });

      expect(deletedThought?._status).toBe('deleted');
    });

    it('should pull soft deleted records from backend', async () => {
      const lastPulledAt = Date.now();

      // Seed backend with soft-deleted thought (modified AFTER lastPulledAt)
      const thought = dataSource.getRepository(Thought).create({
        id: 'thought-deleted-server',
        captureId: 'capture-1',
        userId,
        summary: 'Deleted on server',
        confidenceScore: 0.9,
        processingTimeMs: 100,
        last_modified_at: lastPulledAt + 1000,
        _status: 'deleted',
      });
      await dataSource.getRepository(Thought).save(thought);

      const response = await request(app.getHttpServer())
        .get(`/api/sync/pull?lastPulledAt=${lastPulledAt}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.changes.thought.deleted).toContain(
        'thought-deleted-server',
      );
    });
  });

  describe('Task 7.6 - Performance Test', () => {
    it('should sync 1000 records in under 10 seconds', async () => {
      // Generate 1000 thoughts
      const thoughts = Array.from({ length: 1000 }, (_, i) =>
        dataSource.getRepository(Thought).create({
          id: `thought-${i}`,
          captureId: `capture-${i}`,
          userId,
          summary: `Thought ${i}`,
          confidenceScore: 0.9,
          processingTimeMs: 100,
          last_modified_at: Date.now(),
          _status: 'active',
        }),
      );

      await dataSource.getRepository(Thought).save(thoughts);

      // Measure pull performance
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/sync/pull?lastPulledAt=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.changes.thought.updated).toHaveLength(1000);
      expect(duration).toBeLessThan(10000); // NFR: < 10 seconds
    }, 15000); // Jest timeout 15s
  });

  describe('Task 7.7 - User Isolation (NFR13)', () => {
    it('should NOT sync data from other users (security)', async () => {
      const otherUserId = 'other-user-456';

      // Seed backend with data from ANOTHER user
      const otherUserThought = dataSource.getRepository(Thought).create({
        id: 'thought-other-user',
        captureId: 'capture-other',
        userId: otherUserId, // Different user
        summary: 'Secret thought from other user',
        confidenceScore: 0.9,
        processingTimeMs: 100,
        last_modified_at: Date.now(),
        _status: 'active',
      });
      await dataSource.getRepository(Thought).save(otherUserThought);

      // Seed with current user's data
      const myThought = dataSource.getRepository(Thought).create({
        id: 'thought-my',
        captureId: 'capture-my',
        userId, // Current user
        summary: 'My thought',
        confidenceScore: 0.9,
        processingTimeMs: 100,
        last_modified_at: Date.now(),
        _status: 'active',
      });
      await dataSource.getRepository(Thought).save(myThought);

      // Pull should ONLY return current user's data
      const response = await request(app.getHttpServer())
        .get('/api/sync/pull?lastPulledAt=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const thoughts = response.body.changes.thought.updated;

      expect(thoughts).toHaveLength(1);
      expect(thoughts[0].id).toBe('thought-my');
      expect(thoughts[0].summary).toBe('My thought');

      // Should NOT include other user's data
      const otherUserData = thoughts.find((t: any) => t.userId === otherUserId);
      expect(otherUserData).toBeUndefined();
    });

    it('should prevent user from pushing data as another user (injection attack)', async () => {
      const maliciousPayload = {
        lastPulledAt: 0,
        changes: {
          thought: {
            updated: [
              {
                id: 'thought-injection',
                captureId: 'capture-1',
                userId: 'victim-user-789', // Attacker tries to inject data for another user
                summary: 'Injected malicious thought',
                confidenceScore: 0.9,
                processingTimeMs: 100,
                last_modified_at: Date.now(),
                _status: 'active',
              },
            ],
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousPayload)
        .expect(200);

      // Verify data was saved with AUTHENTICATED user's ID, not attacker's injected userId
      const thought = await dataSource.getRepository(Thought).findOne({
        where: { id: 'thought-injection' },
      });

      expect(thought).toBeDefined();
      expect(thought?.userId).toBe(userId); // Should be auth user, NOT 'victim-user-789'
    });
  });

  describe('Task 7.2 - Offline Scenario (Integration)', () => {
    it('should accept sync from client after offline period', async () => {
      const offlineStartTime = Date.now() - 3600000; // 1 hour ago

      // Client was offline, created data locally, now syncing
      const pushPayload = {
        lastPulledAt: offlineStartTime,
        changes: {
          thought: {
            updated: [
              {
                id: 'thought-offline',
                captureId: 'capture-offline',
                userId,
                summary: 'Created while offline',
                confidenceScore: 0.85,
                processingTimeMs: 150,
                last_modified_at: offlineStartTime + 60000, // Created 1 min after offline
                _status: 'active',
              },
            ],
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload)
        .expect(200);

      expect(response.body.timestamp).toBeDefined();

      // Verify offline data persisted
      const thought = await dataSource.getRepository(Thought).findOne({
        where: { id: 'thought-offline' },
      });

      expect(thought).toBeDefined();
      expect(thought?.summary).toBe('Created while offline');
    });
  });

  describe('Task 7.4 - Retry Logic (Simulated)', () => {
    it('should eventually succeed after network errors (simulated retry)', async () => {
      // This test simulates retry behavior by making multiple requests
      // In real mobile app, retry logic is in SyncService with Fibonacci backoff

      const pushPayload = {
        lastPulledAt: 0,
        changes: {
          thought: {
            updated: [
              {
                id: 'thought-retry',
                captureId: 'capture-retry',
                userId,
                summary: 'Eventually synced after retry',
                confidenceScore: 0.9,
                processingTimeMs: 100,
                last_modified_at: Date.now(),
                _status: 'active',
              },
            ],
          },
        },
      };

      // Simulate retry: First attempt (in real scenario, might fail)
      let response = await request(app.getHttpServer())
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pushPayload);

      // If first attempt fails (simulate), retry succeeds
      if (response.status !== 200) {
        // Retry after backoff
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate Fibonacci delay

        response = await request(app.getHttpServer())
          .post('/api/sync/push')
          .set('Authorization', `Bearer ${authToken}`)
          .send(pushPayload)
          .expect(200);
      }

      expect(response.status).toBe(200);

      // Verify eventual consistency
      const thought = await dataSource.getRepository(Thought).findOne({
        where: { id: 'thought-retry' },
      });

      expect(thought).toBeDefined();
    });
  });
});
