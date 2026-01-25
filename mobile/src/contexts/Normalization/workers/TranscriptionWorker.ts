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
import { TranscriptionQueueService } from '../services/TranscriptionQueueService';
import { TranscriptionService } from '../services/TranscriptionService';
import { WhisperModelService } from '../services/WhisperModelService';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import {
  showTranscriptionCompleteNotification,
  showTranscriptionFailedNotification,
} from '../../../shared/utils/notificationUtils';

/**
 * Worker state
 */
type WorkerState = 'stopped' | 'running' | 'paused';

@injectable()
export class TranscriptionWorker {
  private state: WorkerState = 'stopped';
  private processingLoop: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
  private whisperModelService: WhisperModelService;

  constructor(
    private queueService: TranscriptionQueueService,
    private transcriptionService: TranscriptionService,
    @inject(TOKENS.ICaptureRepository) private captureRepository: ICaptureRepository
  ) {
    this.whisperModelService = new WhisperModelService();
  }

  /**
   * Ensure the Whisper model is loaded before transcription
   *
   * @returns true if model is ready, false if not available
   */
  private async ensureModelLoaded(): Promise<boolean> {
    // Check if already loaded
    if (this.transcriptionService.isModelLoaded()) {
      return true;
    }

    // Check if model is downloaded
    const isDownloaded = await this.whisperModelService.isModelDownloaded('tiny');
    if (!isDownloaded) {
      console.warn('[TranscriptionWorker] ⚠️ Whisper model not downloaded. Please download from Settings.');
      return false;
    }

    // Load the model
    try {
      const modelPath = this.whisperModelService.getModelPath('tiny');
      await this.transcriptionService.loadModel(modelPath);
      return true;
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Failed to load Whisper model:', error);
      return false;
    }
  }

  /**
   * Start foreground processing loop
   *
   * Call when app starts or returns to foreground.
   * Idempotent: Multiple calls have no effect.
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      console.warn('[TranscriptionWorker] Already running, ignoring start()');
      return;
    }

    this.state = 'running';
    console.log('[TranscriptionWorker] ✅ Started foreground processing loop');

    // Start continuous processing loop
    this.startProcessingLoop();
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

    // Stop processing loop
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = null;
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

    // Stop foreground loop
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = null;
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

    // Restart foreground loop
    this.startProcessingLoop();

    console.log('[TranscriptionWorker] ▶️  Resumed');
  }

  /**
   * Get current worker state
   */
  getState(): WorkerState {
    return this.state;
  }

  /**
   * Start continuous processing loop (foreground)
   *
   * Polls queue every 2 seconds, processes one item at a time.
   * Stops when worker is paused or stopped.
   */
  private startProcessingLoop(): void {
    // Clear any existing loop
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
    }

    // Process immediately, then poll at interval
    this.processNextItem();

    this.processingLoop = setInterval(() => {
      if (this.state === 'running') {
        this.processNextItem();
      }
    }, this.POLL_INTERVAL_MS);
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
   */
  private async processNextItem(): Promise<void> {
    try {
      // Check if paused (DB flag checked for background task coordination)
      const isPaused = await this.queueService.isPaused();
      if (isPaused || this.state !== 'running') {
        return;
      }

      // Get next capture from queue (FIFO)
      const queuedCapture = await this.queueService.getNextCapture();

      if (!queuedCapture) {
        // Queue empty, nothing to process
        return;
      }

      // Ensure model is loaded before transcription
      const modelReady = await this.ensureModelLoaded();
      if (!modelReady) {
        console.warn('[TranscriptionWorker] ⏸️ Skipping transcription - model not ready');
        return;
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
        const transcribedText = await this.transcriptionService.transcribe(
          queuedCapture.audioPath,
          queuedCapture.audioDuration
        );

        // Update capture with transcription result
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: transcribedText,
          state: 'ready',
        });

        console.log(
          `[TranscriptionWorker] ✅ Transcribed capture ${queuedCapture.captureId}: "${transcribedText.substring(0, 50)}${transcribedText.length > 50 ? '...' : ''}"`
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
        await showTranscriptionCompleteNotification(queuedCapture.captureId, transcribedText);
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
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Error processing item:', error);
      // Error already logged, continue processing queue
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
        const transcribedText = await this.transcriptionService.transcribe(
          queuedCapture.audioPath,
          queuedCapture.audioDuration
        );

        // Update capture with result
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: transcribedText,
          state: 'ready',
        });

        // Mark as completed in queue
        await this.queueService.markCompleted(queuedCapture.captureId);

        console.log(
          `[TranscriptionWorker] ✅ Background transcribed ${queuedCapture.captureId}: "${transcribedText.substring(0, 30)}${transcribedText.length > 30 ? '...' : ''}"`
        );

        // Send notification (background task = app is backgrounded)
        await showTranscriptionCompleteNotification(queuedCapture.captureId, transcribedText);

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
