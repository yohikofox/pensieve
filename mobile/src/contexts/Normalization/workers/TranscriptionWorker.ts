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
import { InteractionManager, Platform } from 'react-native';
import type { Subscription } from 'rxjs';
import { TranscriptionQueueService } from '../services/TranscriptionQueueService';
import { TranscriptionService } from '../services/TranscriptionService';
import { TranscriptionEngineService } from '../services/TranscriptionEngineService';
import { NativeTranscriptionEngine } from '../services/NativeTranscriptionEngine';
import { TranscriptionModelService, type WhisperModelSize } from '../services/TranscriptionModelService';
import { PostProcessingService } from '../services/PostProcessingService';
import { DeviceCapabilitiesService } from '../services/DeviceCapabilitiesService';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import type { ICaptureMetadataRepository } from '../../capture/domain/ICaptureMetadataRepository';
import { METADATA_KEYS } from '../../capture/domain/CaptureMetadata.model';
import type { EventBus } from '../../shared/events/EventBus';
import type { QueueItemAddedEvent } from '../events/QueueEvents';
import {
  showTranscriptionCompleteNotification,
  showTranscriptionFailedNotification,
} from '../../../shared/utils/notificationUtils';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { TranscriptionEngineType } from '../services/ITranscriptionEngine';

/**
 * Worker state
 */
type WorkerState = 'stopped' | 'running' | 'paused';

@injectable()
export class TranscriptionWorker {
  private state: WorkerState = 'stopped';
  private isProcessing: boolean = false; // True when actively processing queue
  private whisperModelService: TranscriptionModelService;
  private postProcessingService: PostProcessingService;
  private engineService: TranscriptionEngineService;
  private nativeEngine: NativeTranscriptionEngine;
  private eventSubscription: Subscription | null = null;
  private currentWhisperModel: WhisperModelSize | null = null;

  // Task 6.3: Auto-retry with exponential backoff
  private retryTimers: Map<string, NodeJS.Timeout> = new Map(); // captureId → timer
  private readonly MAX_AUTO_RETRIES = 3; // Stop after 3 failed attempts
  private readonly RETRY_DELAYS = [5000, 30000, 300000]; // 5s, 30s, 5min

  constructor(
    private queueService: TranscriptionQueueService,
    private transcriptionService: TranscriptionService,
    @inject(TOKENS.ICaptureRepository) private captureRepository: ICaptureRepository,
    @inject(TOKENS.ICaptureMetadataRepository) private metadataRepository: ICaptureMetadataRepository,
    @inject('EventBus') private eventBus: EventBus,
    postProcessingService: PostProcessingService,
    engineService: TranscriptionEngineService,
    nativeEngine: NativeTranscriptionEngine,
    private deviceCapabilities: DeviceCapabilitiesService // Task 7.3
  ) {
    this.whisperModelService = new TranscriptionModelService();
    this.postProcessingService = postProcessingService;
    this.engineService = engineService;
    this.nativeEngine = nativeEngine;
  }

  /**
   * Task 6.3: Calculate retry delay based on retry count
   * Exponential backoff: 5s, 30s, 5min
   *
   * @param retryCount - Number of retries so far (1, 2, 3)
   * @returns Delay in milliseconds, or null if no more retries allowed
   */
  private getRetryDelay(retryCount: number): number | null {
    if (retryCount <= 0 || retryCount > this.MAX_AUTO_RETRIES) {
      return null; // No retry
    }
    // Map retryCount to delay index (retryCount 1 → index 0)
    return this.RETRY_DELAYS[retryCount - 1] || null;
  }

  /**
   * Task 6.3: Check if auto-retry is allowed for this retry count
   *
   * @param retryCount - Number of retries so far
   * @returns true if auto-retry allowed, false if max retries reached
   */
  private shouldAutoRetry(retryCount: number): boolean {
    return retryCount <= this.MAX_AUTO_RETRIES;
  }

  /**
   * Task 6.3: Schedule automatic retry for a failed transcription
   *
   * @param queueId - Queue ID of the item to retry
   * @param captureId - Capture ID (for logging)
   * @param retryCount - Current retry count (after failure)
   */
  private scheduleRetry(queueId: string, captureId: string, retryCount: number): void {
    // Cancel any existing retry timer for this capture
    this.cancelRetry(captureId);

    const delay = this.getRetryDelay(retryCount); // Delay for this retry attempt
    if (!delay) {
      console.log(`[TranscriptionWorker] ❌ Max retries (${this.MAX_AUTO_RETRIES}) reached for ${captureId}, no auto-retry`);
      return;
    }

    console.log(`[TranscriptionWorker] ⏰ Scheduling retry #${retryCount} for ${captureId} in ${delay}ms`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(captureId);
      console.log(`[TranscriptionWorker] 🔄 Auto-retry #${retryCount} triggered for ${captureId}`);

      // Reset item to 'pending' status in queue (without incrementing retry_count again)
      await this.queueService.retryFailed(queueId);

      // Trigger queue processing to pick up the retried item
      this.triggerProcessing();
    }, delay);

    this.retryTimers.set(captureId, timer);
  }

  /**
   * Task 6.3: Cancel scheduled retry for a capture
   *
   * @param captureId - Capture ID
   */
  private cancelRetry(captureId: string): void {
    const timer = this.retryTimers.get(captureId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(captureId);
      console.log(`[TranscriptionWorker] 🚫 Cancelled scheduled retry for ${captureId}`);
    }
  }

  /**
   * Task 6.3: Cancel all scheduled retries (worker stop/pause)
   */
  private cancelAllRetries(): void {
    this.retryTimers.forEach((timer, captureId) => {
      clearTimeout(timer);
      console.log(`[TranscriptionWorker] 🚫 Cancelled retry for ${captureId}`);
    });
    this.retryTimers.clear();
  }

  /**
   * Check if native file transcription is supported
   * Only available on Android 13+ (API 33+)
   */
  private isNativeFileTranscriptionSupported(): boolean {
    if (Platform.OS !== 'android') {
      return false; // iOS doesn't support file-based native transcription
    }
    const apiLevel = Platform.Version;
    return typeof apiLevel === 'number' && apiLevel >= 33;
  }

  /**
   * Get the effective engine to use for transcription
   * Falls back to Whisper if native is not available for file transcription
   */
  private async getEffectiveEngine(): Promise<TranscriptionEngineType> {
    const selectedEngine = await this.engineService.getSelectedEngineType();

    if (selectedEngine === 'native') {
      if (!this.isNativeFileTranscriptionSupported()) {
        console.log('[TranscriptionWorker] Native file transcription not supported on this device, falling back to Whisper');
        return 'whisper';
      }
    }

    return selectedEngine;
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
    if (this.transcriptionService.isModelLoaded() && this.currentWhisperModel) {
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
      this.currentWhisperModel = selectedModel;
      return true;
    } catch (error) {
      console.error('[TranscriptionWorker] ❌ Failed to load Whisper model:', error);
      this.currentWhisperModel = null;
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

    // Task 7.3: Check device capabilities and warn if low-end
    try {
      const capabilities = await this.deviceCapabilities.detectCapabilities();
      console.log(`[TranscriptionWorker] 📱 Device tier: ${capabilities.tier}`, {
        recommended: capabilities.recommendedWhisperModel,
        hasAcceleration: capabilities.hasAcceleration,
        device: capabilities.deviceInfo,
      });

      if (capabilities.shouldWarnPerformance && capabilities.performanceWarning) {
        console.warn(`[TranscriptionWorker] ⚠️ ${capabilities.performanceWarning}`);
        // TODO: Show UI alert/toast to user (requires UI integration)
      }
    } catch (error) {
      console.warn('[TranscriptionWorker] Failed to detect device capabilities:', error);
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

    // Task 6.3: Cancel all pending retries
    this.cancelAllRetries();

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

    // Task 6.3: Cancel all pending retries
    this.cancelAllRetries();

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

      // Determine which engine to use
      const effectiveEngine = await this.getEffectiveEngine();
      const selectedEngine = await this.engineService.getSelectedEngineType();

      // Log if fallback occurred
      if (selectedEngine === 'native' && effectiveEngine === 'whisper') {
        console.log('[TranscriptionWorker] ⚠️ Native engine selected but not supported for file transcription, falling back to Whisper');
      }
      console.log(`[TranscriptionWorker] 🔧 Using engine: ${effectiveEngine}`);

      // Ensure model is loaded for Whisper engine
      if (effectiveEngine === 'whisper') {
        const modelReady = await this.ensureModelLoaded();
        if (!modelReady) {
          // Mark item as failed instead of silently skipping
          const errorMessage = selectedEngine === 'native'
            ? 'Transcription native non supportée sur cet appareil et aucun modèle Whisper téléchargé'
            : 'Aucun modèle Whisper téléchargé';

          console.error('[TranscriptionWorker] ❌ Cannot transcribe:', errorMessage);

          await this.captureRepository.update(queuedCapture.captureId, {
            state: 'failed',
          });
          await this.queueService.markFailed(queuedCapture.captureId, errorMessage);
          await showTranscriptionFailedNotification(queuedCapture.captureId, errorMessage);

          return true; // Item was processed (as failed)
        }
      }

      console.log(
        `[TranscriptionWorker] 🎙️  Processing capture ${queuedCapture.captureId}` +
          (queuedCapture.audioDuration
            ? ` (${Math.round(queuedCapture.audioDuration / 1000)}s)`
            : '') +
          ` [${effectiveEngine}]`
      );

      try {
        // Update capture state to 'processing'
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'processing',
        });

        let rawTranscript: string;
        let wavPath: string | undefined;
        let transcriptPrompt: string | undefined;
        let nativeRecognitionResults: unknown = undefined;

        if (effectiveEngine === 'native') {
          // Use native speech recognition
          const nativeResult = await this.nativeEngine.transcribeFile(
            queuedCapture.audioPath,
            { language: 'fr' } // TODO: Get from user settings
          );
          rawTranscript = nativeResult.text;
          nativeRecognitionResults = nativeResult.nativeResults;
        } else {
          // Use Whisper.rn via TranscriptionService
          const transcriptionResult = await this.transcriptionService.transcribe(
            queuedCapture.audioPath,
            queuedCapture.audioDuration
          );
          rawTranscript = transcriptionResult.text;
          wavPath = transcriptionResult.wavPath;
          transcriptPrompt = transcriptionResult.transcriptPrompt;
        }

        // Check if transcription returned empty result (no speech detected)
        if (!rawTranscript || rawTranscript.trim().length === 0) {
          console.log('[TranscriptionWorker] ⚠️ No speech detected in audio');
          await this.captureRepository.update(queuedCapture.captureId, {
            state: 'ready',
            normalizedText: '',
            transcriptionError: null,
          });
          await this.queueService.markCompleted(queuedCapture.captureId, '');
          await showTranscriptionCompleteNotification(queuedCapture.captureId, '');
          return true; // Item was processed successfully (no speech is not an error)
        }

        // Post-process transcription with LLM if automatic post-processing is enabled
        // Use InteractionManager to avoid blocking UI during LLM inference
        let finalText = rawTranscript;
        let llmApplied = false;

        // Check if automatic post-processing is enabled (separate from general post-processing availability)
        const autoPostProcessEnabled = await this.postProcessingService.isAutoPostProcessEnabled();

        if (autoPostProcessEnabled && await this.postProcessingService.isEnabled()) {
          try {
            // Wait for UI interactions to complete before heavy LLM work
            await new Promise<void>((resolve) => {
              InteractionManager.runAfterInteractions(() => resolve());
            });

            const processedText = await this.postProcessingService.process(rawTranscript);
            // Only log success if text was actually modified
            if (processedText !== rawTranscript) {
              finalText = processedText;
              llmApplied = true;
              console.log('[TranscriptionWorker] ✅ Post-processing applied');
            } else {
              console.log('[TranscriptionWorker] ⏭️ Post-processing skipped (no changes or not ready)');
            }
          } catch (postProcessError) {
            console.warn('[TranscriptionWorker] ⚠️ Post-processing failed, using original:', postProcessError);
            // Fallback: use original text if LLM fails
          }
        } else if (!autoPostProcessEnabled) {
          console.log('[TranscriptionWorker] ⏭️ Auto post-processing disabled, using raw transcript');
        }

        // Update capture with normalized text and state
        console.log('[TranscriptionWorker] 💾 Saving normalizedText:', {
          captureId: queuedCapture.captureId,
          finalTextLength: finalText?.length || 0,
          finalTextPreview: finalText?.substring(0, 50) || '(empty)',
          rawTranscriptLength: rawTranscript?.length || 0,
          engine: effectiveEngine,
        });
        // Update capture to 'ready' state and clear error (Story 2.8 - Task 6)
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: finalText,
          state: 'ready',
          wavPath: wavPath,
          transcriptionError: null, // Clear error on success
        });

        // Save metadata to capture_metadata table
        const metrics = effectiveEngine === 'whisper' ? this.transcriptionService.getLastPerformanceMetrics() : null;
        const llmModelId = llmApplied ? this.postProcessingService.getCurrentModelId() : null;
        // Serialize native recognition results safely
        let nativeResultsJson: string | null = null;
        if (nativeRecognitionResults) {
          try {
            nativeResultsJson = JSON.stringify(nativeRecognitionResults);
          } catch (serializeError) {
            console.warn('[TranscriptionWorker] Failed to serialize native recognition results:', serializeError);
          }
        }

        await this.metadataRepository.setMany(queuedCapture.captureId, [
          { key: METADATA_KEYS.RAW_TRANSCRIPT, value: rawTranscript },
          { key: METADATA_KEYS.WHISPER_MODEL, value: effectiveEngine === 'whisper' ? this.currentWhisperModel : 'native' },
          { key: METADATA_KEYS.TRANSCRIPT_PROMPT, value: transcriptPrompt || null },
          { key: METADATA_KEYS.WHISPER_DURATION_MS, value: metrics?.transcriptionDuration?.toString() || null },
          ...(llmApplied && llmModelId ? [
            { key: METADATA_KEYS.LLM_MODEL, value: llmModelId },
          ] : []),
          ...(nativeResultsJson ? [
            { key: METADATA_KEYS.NATIVE_RECOGNITION_RESULTS, value: nativeResultsJson },
          ] : []),
        ]);

        console.log(
          `[TranscriptionWorker] ✅ Transcribed capture ${queuedCapture.captureId} [${effectiveEngine}]: "${finalText.substring(0, 50)}${finalText.length > 50 ? '...' : ''}"` +
          (wavPath ? ` (WAV kept: ${wavPath})` : '') +
          (transcriptPrompt ? ` (prompt: ${transcriptPrompt.substring(0, 30)}...)` : '')
        );

        // Log performance metrics (Whisper only)
        if (metrics) {
          console.log(
            `[TranscriptionWorker] 📊 Performance: ${metrics.transcriptionDuration}ms for ${metrics.audioDuration}ms audio (${metrics.ratio}x) - NFR2: ${metrics.meetsNFR2 ? '✅' : '❌'}`
          );
        }

        // Mark as completed in queue
        await this.queueService.markCompleted(queuedCapture.captureId);

        // Send notification (if app backgrounded)
        await showTranscriptionCompleteNotification(queuedCapture.captureId, finalText);
      } catch (transcriptionError) {
        // Task 6.3: Exponential backoff retry logic
        const currentRetryCount = queuedCapture.retryCount;
        const errorMessage = transcriptionError instanceof Error
          ? transcriptionError.message
          : String(transcriptionError);

        console.error(
          `[TranscriptionWorker] ❌ Transcription failed for ${queuedCapture.captureId} (attempt ${currentRetryCount + 1}):`,
          transcriptionError
        );

        // Mark as failed in queue (increments retry_count)
        await this.queueService.markFailed(queuedCapture.captureId, errorMessage);

        const newRetryCount = currentRetryCount + 1; // After markFailed() increments
        const now = Date.now();

        // Get current retry window start from capture
        const capture = await this.captureRepository.findById(queuedCapture.captureId);
        const existingWindowStart = capture?.retryWindowStartAt?.getTime() || null;

        // Update capture state to 'failed' with retry metadata (Story 2.8 - Task 7)
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'failed',
          retryCount: newRetryCount,
          lastRetryAt: new Date(now),
          retryWindowStartAt: existingWindowStart ? new Date(existingWindowStart) : new Date(now),
          transcriptionError: errorMessage,
        });

        // Check if auto-retry is allowed
        if (this.shouldAutoRetry(newRetryCount)) {
          // Schedule automatic retry with exponential backoff
          console.log(
            `[TranscriptionWorker] 🔄 Will auto-retry ${queuedCapture.captureId} (${newRetryCount}/${this.MAX_AUTO_RETRIES})`
          );
          this.scheduleRetry(queuedCapture.id, queuedCapture.captureId, newRetryCount);
        } else {
          // Max retries reached, send failure notification
          console.log(
            `[TranscriptionWorker] ❌ Max retries reached for ${queuedCapture.captureId}, giving up`
          );
          await showTranscriptionFailedNotification(queuedCapture.captureId, errorMessage);
        }
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

        // Store raw Whisper transcript
        const rawTranscript = transcriptionResult.text;

        // Post-process transcription with LLM if enabled
        // Use InteractionManager to avoid blocking UI during LLM inference
        let finalText = rawTranscript;
        if (await this.postProcessingService.isEnabled()) {
          try {
            // Wait for UI interactions to complete before heavy LLM work
            await new Promise<void>((resolve) => {
              InteractionManager.runAfterInteractions(() => resolve());
            });

            const processedText = await this.postProcessingService.process(rawTranscript);
            if (processedText !== rawTranscript) {
              finalText = processedText;
              console.log('[TranscriptionWorker] ✅ Background post-processing applied');
            } else {
              console.log('[TranscriptionWorker] ⏭️ Background post-processing skipped (no changes or not ready)');
            }
          } catch (postProcessError) {
            console.warn('[TranscriptionWorker] ⚠️ Background post-processing failed, using original:', postProcessError);
            // Fallback: use original text if LLM fails
          }
        }

        // Update capture with normalized text and state
        console.log('[TranscriptionWorker] 💾 Background saving normalizedText:', {
          captureId: queuedCapture.captureId,
          finalTextLength: finalText?.length || 0,
          finalTextPreview: finalText?.substring(0, 50) || '(empty)',
          rawTranscriptLength: rawTranscript?.length || 0,
        });
        // Update capture to 'ready' state and clear error (Story 2.8 - Task 6)
        await this.captureRepository.update(queuedCapture.captureId, {
          normalizedText: finalText,
          state: 'ready',
          wavPath: transcriptionResult.wavPath,
          transcriptionError: null, // Clear error on success
        });

        // Save metadata to capture_metadata table
        const metrics = this.transcriptionService.getLastPerformanceMetrics();
        const llmModelIdBg = this.postProcessingService.getCurrentModelId();
        const llmAppliedBg = finalText !== rawTranscript && llmModelIdBg;
        await this.metadataRepository.setMany(queuedCapture.captureId, [
          { key: METADATA_KEYS.RAW_TRANSCRIPT, value: rawTranscript },
          { key: METADATA_KEYS.WHISPER_MODEL, value: this.currentWhisperModel },
          { key: METADATA_KEYS.TRANSCRIPT_PROMPT, value: transcriptionResult.transcriptPrompt || null },
          { key: METADATA_KEYS.WHISPER_DURATION_MS, value: metrics?.transcriptionDuration?.toString() || null },
          ...(llmAppliedBg ? [
            { key: METADATA_KEYS.LLM_MODEL, value: llmModelIdBg },
          ] : []),
        ]);

        // Mark as completed in queue
        await this.queueService.markCompleted(queuedCapture.captureId);

        console.log(
          `[TranscriptionWorker] ✅ Background transcribed ${queuedCapture.captureId}: "${finalText.substring(0, 30)}${finalText.length > 30 ? '...' : ''}"` +
          (transcriptionResult.wavPath ? ` (WAV kept)` : '') +
          (transcriptionResult.transcriptPrompt ? ` (prompt used)` : '')
        );

        // Send notification (background task = app is backgrounded)
        await showTranscriptionCompleteNotification(queuedCapture.captureId, finalText);

        return true;
      } catch (transcriptionError) {
        const errorMessage = transcriptionError instanceof Error
          ? transcriptionError.message
          : String(transcriptionError);
        await this.queueService.markFailed(queuedCapture.captureId, errorMessage);

        // Get current retry count after markFailed
        const newRetryCount = queuedCapture.retryCount + 1;
        const now = Date.now();

        // Get current retry window start from capture
        const capture = await this.captureRepository.findById(queuedCapture.captureId);
        const existingWindowStart = capture?.retryWindowStartAt?.getTime() || null;

        // Update capture state to 'failed' with retry metadata (Story 2.8 - Task 7)
        await this.captureRepository.update(queuedCapture.captureId, {
          state: 'failed',
          retryCount: newRetryCount,
          lastRetryAt: new Date(now),
          retryWindowStartAt: existingWindowStart ? new Date(existingWindowStart) : new Date(now),
          transcriptionError: errorMessage,
        });

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
