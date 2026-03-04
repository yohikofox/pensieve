/**
 * AnalysisQueueService — Queue séquentielle d'analyses LLM
 *
 * Résout le crash concurrent LitertLm (unload pendant generate) en garantissant
 * qu'une seule inférence LLM s'exécute à la fois, quel que soit le nombre
 * de demandes simultanées.
 *
 * Architecture:
 * - In-memory FIFO queue (pas de persistance — les analyses sont best-effort)
 * - Flag isProcessing pour garantir l'exclusivité mutuelle
 * - EventBus pour notifier l'UI de la complétion / l'échec
 * - Dédoublonnage sur (captureId, type) pour éviter les doublons
 *
 * Story 16.3 — Queue d'Analyses Asynchrone
 * ADR-021 — Singleton justifié (état partagé : queue, isProcessing)
 */

import 'reflect-metadata';
import { inject, injectable, singleton } from 'tsyringe';
import type { EventBus } from '../../shared/events/EventBus';
import { CaptureAnalysisService } from './CaptureAnalysisService';
import type { AnalysisType } from '../../capture/domain/CaptureAnalysis.model';
import type {
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
  AnalysisStartedEvent,
} from '../events/AnalysisEvents';

export type AnalysisQueueStatus = 'idle' | 'queued' | 'processing';

interface QueueItem {
  captureId: string;
  type: AnalysisType;
}

@singleton()
@injectable()
export class AnalysisQueueService {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentItem: QueueItem | null = null;

  constructor(
    @inject(CaptureAnalysisService) private analysisService: CaptureAnalysisService,
    @inject('EventBus') private eventBus: EventBus,
  ) {}

  /**
   * Enqueue an analysis request.
   *
   * Returns immediately (non-blocking). The worker starts automatically
   * if it is currently idle. Duplicate requests (same captureId + type)
   * are silently ignored (AC6).
   *
   * @param captureId - Capture to analyse
   * @param type - Analysis type
   */
  enqueue(captureId: string, type: AnalysisType): void {
    if (this.isInQueue(captureId, type)) {
      console.log(`[AnalysisQueueService] ⏭️ Duplicate ignored: ${captureId}/${type}`);
      return;
    }

    this.queue.push({ captureId, type });
    console.log(`[AnalysisQueueService] ➕ Enqueued ${captureId}/${type} (queue length: ${this.queue.length})`);

    // Start worker if idle
    this.processNext();
  }

  /**
   * Check if an item is already in the queue (pending) or currently processing.
   *
   * @param captureId - Capture ID
   * @param type - Analysis type
   * @returns true if already queued or in-progress
   */
  isInQueue(captureId: string, type: AnalysisType): boolean {
    const inPendingQueue = this.queue.some(
      (item) => item.captureId === captureId && item.type === type,
    );
    const isCurrentlyProcessing =
      this.currentItem?.captureId === captureId &&
      this.currentItem?.type === type;
    return inPendingQueue || isCurrentlyProcessing;
  }

  /**
   * Get queue status for a specific capture + analysis type.
   *
   * @param captureId - Capture ID
   * @param type - Analysis type
   * @returns 'processing' | 'queued' | 'idle'
   */
  getItemStatus(captureId: string, type: AnalysisType): AnalysisQueueStatus {
    if (
      this.currentItem?.captureId === captureId &&
      this.currentItem?.type === type
    ) {
      return 'processing';
    }
    if (this.queue.some((item) => item.captureId === captureId && item.type === type)) {
      return 'queued';
    }
    return 'idle';
  }

  /**
   * Get status map for all analysis types of a given capture.
   *
   * @param captureId - Capture ID
   * @returns Status per analysis type
   */
  getQueueStatus(captureId: string): Record<AnalysisType, AnalysisQueueStatus> {
    return {
      summary: this.getItemStatus(captureId, 'summary'),
      highlights: this.getItemStatus(captureId, 'highlights'),
      action_items: this.getItemStatus(captureId, 'action_items'),
      ideas: this.getItemStatus(captureId, 'ideas'),
    };
  }

  /**
   * Current queue length (pending items only, excludes currently processing).
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Whether the worker is currently processing an item.
   */
  get busy(): boolean {
    return this.isProcessing;
  }

  /**
   * Sequential worker — processes one item at a time.
   *
   * Guard: returns immediately if already processing or queue is empty.
   * Recursive: calls itself after each item to drain the queue.
   */
  private processNext(): void {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.currentItem = item;

    console.log(`[AnalysisQueueService] ▶️ Processing ${item.captureId}/${item.type}`);

    const startedEvent: AnalysisStartedEvent = {
      type: 'AnalysisStarted',
      timestamp: Date.now(),
      payload: { captureId: item.captureId, analysisType: item.type },
    };
    this.eventBus.publish(startedEvent);

    this.analysisService
      .analyze(item.captureId, item.type)
      .then((result) => {
        console.log(
          `[AnalysisQueueService] ✅ Completed ${item.captureId}/${item.type} (success: ${result.success})`,
        );
        const event: AnalysisCompletedEvent = {
          type: 'AnalysisCompleted',
          timestamp: Date.now(),
          payload: {
            captureId: item.captureId,
            analysisType: item.type,
            result,
          },
        };
        this.eventBus.publish(event);
      })
      .catch((error: unknown) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Erreur inconnue';
        console.error(
          `[AnalysisQueueService] ❌ Failed ${item.captureId}/${item.type}: ${errorMsg}`,
        );
        const event: AnalysisFailedEvent = {
          type: 'AnalysisFailed',
          timestamp: Date.now(),
          payload: {
            captureId: item.captureId,
            analysisType: item.type,
            error: errorMsg,
          },
        };
        this.eventBus.publish(event);
      })
      .finally(() => {
        this.isProcessing = false;
        this.currentItem = null;
        // Process next item in queue (drain)
        this.processNext();
      });
  }
}
