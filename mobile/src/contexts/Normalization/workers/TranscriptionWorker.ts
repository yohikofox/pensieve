/**
 * TranscriptionWorker - Background Transcription Processor
 *
 * Architecture (ADR-020):
 * - Foreground: Continuous loop processing queue
 * - Background: Periodic checks via expo-task-manager (15min iOS limit)
 * - Crash-proof: Queue persisted in DB, worker is stateless
 *
 * Responsibilities:
 * - Poll transcription queue for pending captures
 * - Process audio files with Whisper.rn via TranscriptionService
 * - Update capture with transcription result (normalizedText, state)
 * - Handle errors and retries
 * - Respect pause state (app backgrounding)
 *
 * Lifecycle:
 * - Start: Begin foreground continuous loop
 * - Stop: Halt processing (app shutdown)
 * - Pause: Temporarily suspend (app backgrounding)
 * - Resume: Continue processing (app foregrounding)
 *
 * Usage:
 * ```typescript
 * const worker = container.resolve(TranscriptionWorker);
 * await worker.start(); // Begin processing
 * await worker.pause(); // App going to background
 * await worker.resume(); // App returned to foreground
 * await worker.stop(); // App shutdown
 * ```
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Subscription } from 'rxjs';
import { TranscriptionQueueService } from '../services/TranscriptionQueueService';
import { TranscriptionService } from '../services/TranscriptionService';
import { WhisperModelService } from '../services/WhisperModelService';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import type { EventBus } from '../../shared/events/EventBus';
import type { QueueItemAddedEvent } from '../events/QueueEvents';
import {
  showTranscriptionCompleteNotification,
  showTranscriptionFailedNotification,
} from '../../../shared/utils/notificationUtils';
import { useSettingsStore } from '../../../stores/settingsStore';

/**
 * Worker state
 */
type WorkerState = 'stopped' | 'running' | 'paused';

@injectable()
export class TranscriptionWorker {
  private state: WorkerState = 'stopped';
  private isProcessing: boolean = false; // True when actively processing queue
  private whisperModelService: WhisperModelService;
  private eventSubscription: Subscription | null = null;

  constructor(
    private queueService: TranscriptionQueueService,
    private transcriptionService: TranscriptionService,
    @inject(TOKENS.ICaptureRepository) private captureRepository: ICaptureRepository,
    @inject('EventBus') private eventBus: EventBus
  ) {
    this.whisperModelService = new WhisperModelService();
  }

  /**
   * Ensure the Whisper model is loaded before transcription
   *
   * Uses the user's selected model preference, or falls back to:
   * 1. 'base' model (better quality) if downloaded
   * 2. 'tiny' model (faster, smaller) as fallback
   *
   * @returns true if model is ready, false if not available
   */
  private async ensureModelLoaded(): Promise<boolean> {
    // Check if already loaded
    if (this.transcriptionService.isModelLoaded()) {
      return true;
    }

    // Get best available model (respects user preference)
    const selectedModel = await this.whisperModelService.getBestAvailableModel();

    if (!selectedModel) {
      console.warn('[TranscriptionWorker] ⚠️ No Whisper model downloaded. Please download from Settings.');
      return false;
    }

    console.log(`[TranscriptionWorker] 📦 Using Whisper model: ${selectedModel}`);

    // Load the model
    try {
      const modelPath = this.whisperModelService.getModelPath(selectedModel);
      await this.transcriptionService.loadModel(modelPath);
      return true;
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Failed to load Whisper model:', error);
      return false;
    }
  }

  /**
   * Start worker (event-driven)
   *
   * Call when app starts or returns to foreground.
   * Subscribes to queue events and processes items when added.
   * Idempotent: Multiple calls have no effect.
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      console.warn('[TranscriptionWorker] Already running, ignoring start()');
      return;
    }

    // Ensure queue is not paused (may have been left paused from previous session)
    await this.queueService.resume();

    // Reset stuck items (crash recovery: processing → pending, failed with low retries → pending)
    const resetCount = await this.queueService.resetStuckItems();
    if (resetCount > 0) {
      console.log(`[TranscriptionWorker] 🔄 Reset ${resetCount} stuck items on startup`);
    }

    this.state = 'running';

    // Subscribe to queue events (event-driven processing)
    // Use arrow function to preserve `this` binding
    this.eventSubscription = this.eventBus.subscribe<QueueItemAddedEvent>(
      'QueueItemAdded',
      (_event) => {
        this.triggerProcessing();
      }
    );

    console.log('[TranscriptionWorker] ✅ Started (event-driven)');

    // Process any existing items in queue (from previous session or crash recovery)
    this.triggerProcessing();
  }

  /**
   * Stop worker (app shutdown)
   *
   * Gracefully stops the worker, allowing current transcription to complete.
   * Idempotent: Multiple calls have no effect.
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return;
    }

    this.state = 'stopped';

    // Unsubscribe from events
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = null;
    }

    console.log('[TranscriptionWorker] 🛑 Stopped');
  }

  /**
   * Pause worker (app backgrounding)
   *
   * Temporarily suspends processing. Queue state persisted in DB.
   * Call when app enters background state.
   */
  async pause(): Promise<void> {
    if (this.state === 'stopped') {
      console.warn('[TranscriptionWorker] Cannot pause - worker is stopped');
      return;
    }

    this.state = 'paused';

    // Update pause flag in DB (checked by background task)
    await this.queueService.pause();

    // Unsubscribe from events (stop reacting to new items)
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = null;
    }

    console.log('[TranscriptionWorker] ⏸️  Paused (app backgrounding)');
  }

  /**
   * Resume worker (app foregrounding)
   *
   * Resumes processing after pause.
   * Call when app returns to foreground.
   */
  async resume(): Promise<void> {
    if (this.state === 'stopped') {
      console.warn('[TranscriptionWorker] Cannot resume - worker is stopped. Call start() instead.');
      return;
    }

    this.state = 'running';

    // Update pause flag in DB
    await this.queueService.resume();

    // Resubscribe to queue events
    if (!this.eventSubscription) {
      this.eventSubscription = this.eventBus.subscribe<QueueItemAddedEvent>(
        'QueueItemAdded',
        (_event) => {
          this.triggerProcessing();
        }
      );
    }

    // Process any items that were added while paused
    this.triggerProcessing();

    console.log('[TranscriptionWorker] ▶️  Resumed');
  }

  /**
   * Get current worker state
   */
  getState(): WorkerState {
    return this.state;
  }

  /**
   * Trigger processing loop (event-driven)
   *
   * Processes all items in queue sequentially until empty.
   * Called when:
   * - Worker starts (process existing items)
   * - Worker resumes (process items added while paused)
   * - New item added to queue (QueueItemAdded event)
   *
   * Safe to call multiple times - only one processing loop runs at a time.
   */
  private triggerProcessing(): void {
    // Already processing - new items will be picked up by the loop
    if (this.isProcessing) {
      if (useSettingsStore.getState().debugMode) {
        console.log('[TranscriptionWorker] Already processing, skipping trigger');
      }
      return;
    }

    // Start processing loop
    this.processUntilEmpty();
  }

  /**
   * Process items until queue is empty
   *
   * Runs sequentially: process one item, then check for more.
   * Stops when queue is empty or worker is paused/stopped.
   */
  private async processUntilEmpty(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.state === 'running') {
        const processed = await this.processNextItem();

        // Queue empty - stop processing
        if (!processed) {
          if (useSettingsStore.getState().debugMode) {
            console.log('[TranscriptionWorker] Queue empty, going idle');
          }
          break;
        }

        // Small delay between items to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process next item in queue
   *
   * Atomic operation:
   * 1. Ensure Whisper model is loaded
   * 2. Get next pending capture from queue (FIFO)
   * 3. Transcribe audio with Whisper
   * 4. Update capture with result
   * 5. Remove from queue (or mark failed for retry)
   *
   * @returns true if an item was processed, false if queue empty or worker not ready
   */
  private async processNextItem(): Promise<boolean> {
    try {
      // Check if paused (DB flag checked for background task coordination)
      const isPaused = await this.queueService.isPaused();
      if (isPaused) {
        console.log('[TranscriptionWorker] ⏸️ Queue is paused, skipping');
        return false;
      }
      if (this.state !== 'running') {
        console.log('[TranscriptionWorker] ⏸️ Worker not running, skipping');
        return false;
      }

      // Get next capture from queue (FIFO)
      const queuedCapture = await this.queueService.getNextCapture();

      if (!queuedCapture) {
        // Queue empty, nothing to process
        return false;
      }

      console.log('[TranscriptionWorker] 📋 Found capture in queue:', queuedCapture.captureId);

      // Ensure model is loaded before transcription
      const modelReady = await this.ensureModelLoaded();
      if (!modelReady) {
        console.warn('[TranscriptionWorker] ⏸️ Skipping transcription - model not ready');
        return false;
      }

      console.log(
        `[TranscriptionWorker] 🎙️  Processing capture ${queuedCapture.captureId}` +
          (queuedCapture.audioDuration
            ? ` (${Math.round(queuedCapture.audioDuration / 1000)}s)`
            : '')
      );

      try {
        // Update capture state to 'processing'
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'processing',
        });

        // Transcribe audio using Whisper.rn via TranscriptionService
        const transcriptionResult = await this.transcriptionService.transcribe(
          queuedCapture.audioPath,
          queuedCapture.audioDuration
        );

        // Update capture with transcription result (wavPath and transcriptPrompt if applicable)
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: transcriptionResult.text,
          state: 'ready',
          wavPath: transcriptionResult.wavPath,
          transcriptPrompt: transcriptionResult.transcriptPrompt,
        });

        console.log(
          `[TranscriptionWorker] ✅ Transcribed capture ${queuedCapture.captureId}: "${transcriptionResult.text.substring(0, 50)}${transcriptionResult.text.length > 50 ? '...' : ''}"` +
          (transcriptionResult.wavPath ? ` (WAV kept: ${transcriptionResult.wavPath})` : '') +
          (transcriptionResult.transcriptPrompt ? ` (prompt: ${transcriptionResult.transcriptPrompt.substring(0, 30)}...)` : '')
        );

        // Log performance metrics
        const metrics = this.transcriptionService.getLastPerformanceMetrics();
        if (metrics) {
          console.log(
            `[TranscriptionWorker] 📊 Performance: ${metrics.transcriptionDuration}ms for ${metrics.audioDuration}ms audio (${metrics.ratio}x) - NFR2: ${metrics.meetsNFR2 ? '✅' : '❌'}`
          );
        }

        // Mark as completed in queue
        await this.queueService.markCompleted(queuedCapture.captureId);

        // Send notification (if app backgrounded)
        await showTranscriptionCompleteNotification(queuedCapture.captureId, transcriptionResult.text);
      } catch (transcriptionError) {
        // Update capture state to 'failed'
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'failed',
        });

        // Mark as failed in queue
        const errorMessage = transcriptionError instanceof Error
          ? transcriptionError.message
          : String(transcriptionError);
        console.error(
          `[TranscriptionWorker] ❌ Transcription failed for ${queuedCapture.captureId}:`,
          transcriptionError
        );
        await this.queueService.markFailed(queuedCapture.captureId, errorMessage);

        // Send failure notification (if app backgrounded)
        await showTranscriptionFailedNotification(queuedCapture.captureId, errorMessage);
      }

      // Item was processed (success or failure)
      return true;
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Error processing item:', error);
      // Error already logged, return false to stop processing
      return false;
    }
  }

  /**
   * Process single item (for background task)
   *
   * Called by expo-task-manager background task.
   * Processes one item then exits (background tasks are time-limited).
   *
   * @returns true if item was processed, false if queue empty
   */
  async processOneItem(): Promise<boolean> {
    try {
      // Check if paused
      const isPaused = await this.queueService.isPaused();
      if (isPaused) {
        console.log('[TranscriptionWorker] Skipping background processing - worker is paused');
        return false;
      }

      // Get next capture from queue
      const queuedCapture = await this.queueService.getNextCapture();

      if (!queuedCapture) {
        // Queue empty
        return false;
      }

      // Ensure model is loaded before transcription
      const modelReady = await this.ensureModelLoaded();
      if (!modelReady) {
        console.warn('[TranscriptionWorker] ⏸️ Skipping background transcription - model not ready');
        return false;
      }

      console.log(`[TranscriptionWorker] 🔙 Background processing capture ${queuedCapture.captureId}`);

      try {
        // Update capture state to 'processing'
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'processing',
        });

        // Transcribe using Whisper.rn
        const transcriptionResult = await this.transcriptionService.transcribe(
          queuedCapture.audioPath,
          queuedCapture.audioDuration
        );

        // Update capture with result (wavPath and transcriptPrompt if applicable)
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: transcriptionResult.text,
          state: 'ready',
          wavPath: transcriptionResult.wavPath,
          transcriptPrompt: transcriptionResult.transcriptPrompt,
        });

        // Mark as completed in queue
        await this.queueService.markCompleted(queuedCapture.captureId);

        console.log(
          `[TranscriptionWorker] ✅ Background transcribed ${queuedCapture.captureId}: "${transcriptionResult.text.substring(0, 30)}${transcriptionResult.text.length > 30 ? '...' : ''}"` +
          (transcriptionResult.wavPath ? ` (WAV kept)` : '') +
          (transcriptionResult.transcriptPrompt ? ` (prompt used)` : '')
        );

        // Send notification (background task = app is backgrounded)
        await showTranscriptionCompleteNotification(queuedCapture.captureId, transcriptionResult.text);

        return true;
      } catch (transcriptionError) {
        // Update capture state to 'failed'
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'failed',
        });

        const errorMessage = transcriptionError instanceof Error
          ? transcriptionError.message
          : String(transcriptionError);
        await this.queueService.markFailed(queuedCapture.captureId, errorMessage);

        console.error(
          `[TranscriptionWorker] ❌ Background transcription failed for ${queuedCapture.captureId}:`,
          transcriptionError
        );

        // Send failure notification
        await showTranscriptionFailedNotification(queuedCapture.captureId, errorMessage);

        return false;
      }
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Background processing error:', error);
      return false;
    }
  }
}
