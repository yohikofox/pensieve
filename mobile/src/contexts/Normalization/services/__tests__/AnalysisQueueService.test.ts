/**
 * Unit Tests — AnalysisQueueService
 *
 * Validates:
 * - enqueue adds items to the queue
 * - isInQueue returns true for pending/processing items
 * - Duplicate requests are ignored (AC6)
 * - Worker processes items sequentially (no concurrency) (AC2)
 * - AnalysisCompleted event emitted on success (AC4)
 * - AnalysisFailed event emitted on error, queue continues (AC7)
 *
 * Story 16.3 — Queue d'Analyses Asynchrone
 */

import 'reflect-metadata';

jest.mock('@op-engineering/op-sqlite');

import { EventBus } from '../../../shared/events/EventBus';
import { AnalysisQueueService } from '../AnalysisQueueService';
import type { CaptureAnalysisService } from '../CaptureAnalysisService';
import type { AnalysisCompletedEvent, AnalysisFailedEvent } from '../../events/AnalysisEvents';
import type { DomainEvent } from '../../../shared/events/DomainEvent';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEventBus(): EventBus {
  return new EventBus();
}

/**
 * Creates a mock AnalysisService.
 * When `neverResolve: true`, the analyze promise never settles (useful for
 * testing synchronous behaviour without leaking async work after test ends).
 */
function makeMockAnalysisService(
  options: {
    neverResolve?: boolean;
    failForCaptureId?: string;
  } = {},
): jest.Mocked<CaptureAnalysisService> {
  const { neverResolve = false, failForCaptureId } = options;

  const analyze = jest.fn().mockImplementation(
    (captureId: string) => {
      if (neverResolve) {
        // Returns a promise that never settles — no async leakage after test ends
        return new Promise<never>(() => {});
      }
      if (captureId === failForCaptureId) {
        return Promise.reject(new Error('Simulated analysis failure'));
      }
      return Promise.resolve({
        success: true as const,
        analysis: {
          id: `analysis-${captureId}`,
          captureId,
          analysisType: 'summary' as const,
          content: 'Result',
          modelId: null,
          processingDurationMs: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    },
  );

  return { analyze } as unknown as jest.Mocked<CaptureAnalysisService>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AnalysisQueueService', () => {
  describe('enqueue', () => {
    it('adds an item to the queue', () => {
      const analysisService = makeMockAnalysisService({ neverResolve: true });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-1', 'summary');

      expect(service.isInQueue('cap-1', 'summary')).toBe(true);
    });

    it('returns without blocking (synchronous return)', () => {
      const analysisService = makeMockAnalysisService({ neverResolve: true });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      const start = Date.now();
      service.enqueue('cap-1', 'summary');
      const elapsed = Date.now() - start;

      // Should return immediately (<100ms even on slow machines)
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('isInQueue (deduplication — AC6)', () => {
    it('returns true for a pending item', () => {
      const analysisService = makeMockAnalysisService({ neverResolve: true });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-1', 'summary');

      expect(service.isInQueue('cap-1', 'summary')).toBe(true);
    });

    it('returns false for an item not in queue', () => {
      const analysisService = makeMockAnalysisService();
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      expect(service.isInQueue('cap-1', 'summary')).toBe(false);
    });

    it('ignores duplicate enqueue for same captureId + type', () => {
      const analysisService = makeMockAnalysisService({ neverResolve: true });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-1', 'summary');
      service.enqueue('cap-1', 'summary'); // duplicate

      // Should still have only 1 item (currently processing)
      expect(service.pendingCount).toBeLessThanOrEqual(1);
      expect(analysisService.analyze).toHaveBeenCalledTimes(1);
    });

    it('allows same captureId with different type', () => {
      const analysisService = makeMockAnalysisService({ neverResolve: true });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-1', 'summary');
      service.enqueue('cap-1', 'highlights');

      expect(service.isInQueue('cap-1', 'highlights')).toBe(true);
    });
  });

  describe('sequential processing (AC2)', () => {
    it('processes items one at a time', async () => {
      const callOrder: string[] = [];
      let concurrentCalls = 0;
      let maxConcurrent = 0;
      const resolvers: Array<() => void> = [];

      const analysisService = {
        analyze: jest.fn().mockImplementation(async (captureId: string) => {
          concurrentCalls++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
          callOrder.push(captureId);
          await new Promise<void>((resolve) => resolvers.push(resolve));
          concurrentCalls--;
          return { success: true as const, analysis: { captureId } as any };
        }),
      } as unknown as jest.Mocked<CaptureAnalysisService>;

      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-1', 'summary');
      service.enqueue('cap-2', 'summary');
      service.enqueue('cap-3', 'summary');

      // Resolve items one by one, verifying only 1 concurrent at a time
      await new Promise((r) => setTimeout(r, 5));
      expect(maxConcurrent).toBe(1);
      resolvers[0]?.();

      await new Promise((r) => setTimeout(r, 5));
      expect(maxConcurrent).toBe(1);
      resolvers[1]?.();

      await new Promise((r) => setTimeout(r, 5));
      resolvers[2]?.();
      await new Promise((r) => setTimeout(r, 5));

      expect(maxConcurrent).toBe(1); // Never more than 1 concurrent call
      expect(callOrder).toEqual(['cap-1', 'cap-2', 'cap-3']); // FIFO order
    });
  });

  describe('AnalysisCompleted event (AC4)', () => {
    it('emits AnalysisCompleted event on success', async () => {
      const analysisService = makeMockAnalysisService();
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      const emittedEvents: DomainEvent[] = [];
      const sub = eventBus.subscribe('AnalysisCompleted', (event) => {
        emittedEvents.push(event);
      });

      service.enqueue('cap-2', 'summary');

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0] as AnalysisCompletedEvent;
      expect(event.type).toBe('AnalysisCompleted');
      expect(event.payload.captureId).toBe('cap-2');
      expect(event.payload.analysisType).toBe('summary');
      expect(event.payload.result.success).toBe(true);

      sub.unsubscribe();
    });
  });

  describe('AnalysisFailed event + queue continues (AC7)', () => {
    it('emits AnalysisFailed and processes next item after failure', async () => {
      const analysisService = makeMockAnalysisService({ failForCaptureId: 'cap-err' });
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      const failedEvents: DomainEvent[] = [];
      const completedEvents: DomainEvent[] = [];

      const failSub = eventBus.subscribe('AnalysisFailed', (event) => {
        failedEvents.push(event);
      });
      const completedSub = eventBus.subscribe('AnalysisCompleted', (event) => {
        completedEvents.push(event);
      });

      service.enqueue('cap-err', 'summary'); // will fail
      service.enqueue('cap-ok', 'summary');  // should still run

      await new Promise((resolve) => setTimeout(resolve, 40));

      expect(failedEvents).toHaveLength(1);
      const failEvent = failedEvents[0] as AnalysisFailedEvent;
      expect(failEvent.payload.captureId).toBe('cap-err');
      expect(failEvent.payload.error).toContain('Simulated analysis failure');

      // Queue continues after failure
      expect(completedEvents).toHaveLength(1);
      const completedEvent = completedEvents[0] as AnalysisCompletedEvent;
      expect(completedEvent.payload.captureId).toBe('cap-ok');

      failSub.unsubscribe();
      completedSub.unsubscribe();
    });
  });

  describe('getItemStatus / getQueueStatus', () => {
    it('returns "idle" for unknown captureId', () => {
      const analysisService = makeMockAnalysisService();
      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      expect(service.getItemStatus('unknown', 'summary')).toBe('idle');
    });

    it('returns "processing" for the item currently being processed', async () => {
      let resolveAnalysis!: () => void;
      const analysisService = {
        analyze: jest.fn().mockImplementation(
          () => new Promise<{ success: true; analysis: any }>((resolve) => {
            resolveAnalysis = () => resolve({ success: true, analysis: {} as any });
          }),
        ),
      } as unknown as jest.Mocked<CaptureAnalysisService>;

      const eventBus = makeEventBus();
      const service = new AnalysisQueueService(analysisService, eventBus);

      service.enqueue('cap-test', 'summary');

      // Give event loop a tick for processNext to run
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(service.getItemStatus('cap-test', 'summary')).toBe('processing');

      resolveAnalysis();
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(service.getItemStatus('cap-test', 'summary')).toBe('idle');
    });
  });
});
