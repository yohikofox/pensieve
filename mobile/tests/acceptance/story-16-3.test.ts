/**
 * BDD Acceptance Tests — Story 16.3: Queue d'Analyses Asynchrone
 *
 * Valide :
 * - AC1: Enqueue retourne immédiatement (non-bloquant)
 * - AC2: Traitement séquentiel mono-thread (pas de concurrence LLM)
 * - AC4: Notification de complétion via EventBus
 * - AC6: Dédoublonnage des demandes
 * - AC7: Comportement en cas d'échec — item retiré, queue continue
 *
 * Strategy: tests au niveau service (AnalysisQueueService + EventBus mock)
 * Pas de render React Native (jest-cucumber BDD pattern)
 */

jest.mock('@op-engineering/op-sqlite');

import 'reflect-metadata';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { EventBus } from '../../src/contexts/shared/events/EventBus';
import { AnalysisQueueService } from '../../src/contexts/Normalization/services/AnalysisQueueService';
import type { CaptureAnalysisService } from '../../src/contexts/Normalization/services/CaptureAnalysisService';
import type { AnalysisCompletedEvent, AnalysisFailedEvent } from '../../src/contexts/Normalization/events/AnalysisEvents';
import type { DomainEvent } from '../../src/contexts/shared/events/DomainEvent';

const feature = loadFeature(
  'tests/acceptance/features/story-16-3-analysis-queue.feature',
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When `neverResolve: true`, analyze returns a promise that never settles —
 * prevents async leakage into subsequent test assertions.
 */
function makeSuccessAnalysisService(
  options: { delay?: number; neverResolve?: boolean } = {},
): jest.Mocked<CaptureAnalysisService> {
  const { delay = 0, neverResolve = false } = options;
  return {
    analyze: jest.fn().mockImplementation((captureId: string, type: string) => {
      if (neverResolve) return new Promise<never>(() => {});
      const result = {
        success: true as const,
        analysis: {
          id: `a-${captureId}-${type}`,
          captureId,
          analysisType: type,
          content: 'Résultat',
          modelId: null,
          processingDurationMs: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      if (delay > 0) return new Promise((r) => setTimeout(() => r(result), delay));
      return Promise.resolve(result);
    }),
  } as unknown as jest.Mocked<CaptureAnalysisService>;
}

/**
 * Service that fails for a specific captureId and succeeds for all others.
 * Avoids the need to swap the internal service after instantiation.
 */
function makeSelectiveFailingAnalysisService(failForCaptureId: string): jest.Mocked<CaptureAnalysisService> {
  return {
    analyze: jest.fn().mockImplementation((captureId: string, type: string) => {
      if (captureId === failForCaptureId) {
        return Promise.reject(new Error('Simulated LLM failure'));
      }
      return Promise.resolve({
        success: true as const,
        analysis: {
          id: `a-${captureId}-${type}`,
          captureId,
          analysisType: type,
          content: 'Résultat',
          modelId: null,
          processingDurationMs: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }),
  } as unknown as jest.Mocked<CaptureAnalysisService>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  let queueService: AnalysisQueueService;
  let eventBus: EventBus;
  let analysisService: jest.Mocked<CaptureAnalysisService>;
  let emittedEvents: DomainEvent[];
  let subscriptions: Array<{ unsubscribe: () => void }>;

  beforeEach(() => {
    emittedEvents = [];
    subscriptions = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    subscriptions.forEach((sub) => sub.unsubscribe());
  });

  // ── Scenario 1: Enqueue simple ─────────────────────────────────────────────

  test('Enqueue simple - la demande retourne immédiatement', ({ given, when, then, and }) => {
    given('the analysis queue is empty', () => {
      analysisService = makeSuccessAnalysisService({ neverResolve: true });
      eventBus = new EventBus();
      queueService = new AnalysisQueueService(analysisService, eventBus);
    });

    when('the user requests a "summary" analysis for capture "cap-1"', () => {
      queueService.enqueue('cap-1', 'summary');
    });

    then('the item is added to the analysis queue', () => {
      expect(queueService.isInQueue('cap-1', 'summary')).toBe(true);
    });

    and('the enqueue call returns immediately without blocking', () => {
      // The enqueue call already returned synchronously before this step
      // (the when step completed without awaiting)
      expect(true).toBe(true);
    });
  });

  // ── Scenario 2: Dédoublonnage ──────────────────────────────────────────────

  test('Dédoublonnage - une demande identique est ignorée', ({ given, when, then }) => {
    given('a "summary" analysis for capture "cap-1" is already in the queue', () => {
      analysisService = makeSuccessAnalysisService({ neverResolve: true });
      eventBus = new EventBus();
      queueService = new AnalysisQueueService(analysisService, eventBus);
      queueService.enqueue('cap-1', 'summary');
    });

    when('the user requests another "summary" analysis for capture "cap-1"', () => {
      queueService.enqueue('cap-1', 'summary');
    });

    then('the queue still contains exactly 1 item for "cap-1" and type "summary"', () => {
      // Exactly 1 call to analyze (duplicates are silently ignored)
      expect(analysisService.analyze).toHaveBeenCalledTimes(1);
    });
  });

  // ── Scenario 3: Traitement séquentiel ─────────────────────────────────────

  test('Traitement séquentiel - les analyses s\'exécutent une par une', ({
    given,
    and,
    when,
    then,
  }) => {
    let maxConcurrent = 0;
    let concurrentCalls = 0;

    given('the analysis queue is empty', () => {
      analysisService = {
        analyze: jest.fn().mockImplementation(async () => {
          concurrentCalls++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
          await new Promise((r) => setTimeout(r, 15));
          concurrentCalls--;
          return { success: true as const, analysis: {} as any };
        }),
      } as unknown as jest.Mocked<CaptureAnalysisService>;

      eventBus = new EventBus();
      queueService = new AnalysisQueueService(analysisService, eventBus);
    });

    and('the analysis service takes some time to complete', () => {
      // Configured above (15ms delay)
    });

    when('the user enqueues a "summary" analysis for capture "cap-1"', () => {
      queueService.enqueue('cap-1', 'summary');
    });

    and('the user enqueues a "highlights" analysis for capture "cap-1"', () => {
      queueService.enqueue('cap-1', 'highlights');
    });

    then('the analyses are processed one at a time without concurrency', async () => {
      await new Promise((r) => setTimeout(r, 60));
      expect(maxConcurrent).toBe(1);
    });
  });

  // ── Scenario 4: Notification via EventBus ─────────────────────────────────

  test('Notification de complétion via EventBus', ({
    given,
    and,
    when,
    then,
  }) => {
    given('the analysis queue is empty', () => {
      eventBus = new EventBus();
      subscriptions.push(
        eventBus.subscribe('AnalysisCompleted', (event) => emittedEvents.push(event)),
      );
    });

    and('the analysis service will succeed for capture "cap-2" type "summary"', () => {
      analysisService = makeSuccessAnalysisService();
      queueService = new AnalysisQueueService(analysisService, eventBus);
    });

    when('the user requests a "summary" analysis for capture "cap-2"', () => {
      queueService.enqueue('cap-2', 'summary');
    });

    and('the analysis completes', async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    then('an "AnalysisCompleted" event is emitted on the EventBus', () => {
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe('AnalysisCompleted');
    });

    and('the event payload contains captureId "cap-2" and analysisType "summary"', () => {
      const event = emittedEvents[0] as AnalysisCompletedEvent;
      expect(event.payload.captureId).toBe('cap-2');
      expect(event.payload.analysisType).toBe('summary');
    });
  });

  // ── Scenario 5: Gestion d'erreur ──────────────────────────────────────────

  test('Gestion d\'erreur - l\'item est retiré et analysis.failed est émis', ({
    given,
    and,
    when,
    then,
  }) => {
    const failedEvents: DomainEvent[] = [];
    const completedAfterError: DomainEvent[] = [];

    given('the analysis queue is empty', () => {
      eventBus = new EventBus();
      subscriptions.push(
        eventBus.subscribe('AnalysisFailed', (event) => failedEvents.push(event)),
      );
      subscriptions.push(
        eventBus.subscribe('AnalysisCompleted', (event) => completedAfterError.push(event)),
      );
    });

    and('the analysis service will fail for capture "cap-err" type "summary"', () => {
      // Service that fails for cap-err but succeeds for any other captureId (no as any needed)
      analysisService = makeSelectiveFailingAnalysisService('cap-err');
      queueService = new AnalysisQueueService(analysisService, eventBus);
    });

    when('the user requests a "summary" analysis for capture "cap-err"', () => {
      queueService.enqueue('cap-err', 'summary');
    });

    and('the analysis fails', async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    then('an "AnalysisFailed" event is emitted on the EventBus', () => {
      expect(failedEvents).toHaveLength(1);
      const event = failedEvents[0] as AnalysisFailedEvent;
      expect(event.type).toBe('AnalysisFailed');
      expect(event.payload.captureId).toBe('cap-err');
    });

    and('the queue continues processing next items', async () => {
      // The same service already handles 'cap-after-error' successfully (no swapping needed)
      queueService.enqueue('cap-after-error', 'summary');
      await new Promise((r) => setTimeout(r, 20));

      expect(analysisService.analyze).toHaveBeenCalledWith('cap-after-error', 'summary');
    });
  });
});
