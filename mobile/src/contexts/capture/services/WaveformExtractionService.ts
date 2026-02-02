/**
 * WaveformExtractionService - Auto-extract waveform from audio captures
 *
 * Architecture (Event-driven):
 * - Subscribes to CaptureRecorded events via EventBus
 * - Automatically extracts waveform data for audio captures
 * - Stores raw RMS values in CaptureMetadata
 * - Lifecycle: Transient (new instance per DI resolve)
 * - State: Stateless (subscription managed via start/stop)
 *
 * Responsibilities:
 * - Listen for CaptureRecorded events
 * - Filter audio captures (ignore text captures)
 * - Extract waveform via expo-waveform-extractor
 * - Save waveform data to metadata
 * - Handle errors gracefully (log, don't crash)
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Subscription } from 'rxjs';
import type { EventBus } from '../../shared/events/EventBus';
import type { CaptureRecordedEvent } from '../events/CaptureEvents';
import type { ICaptureMetadataRepository } from '../domain/ICaptureMetadataRepository';
import { METADATA_KEYS } from '../domain/CaptureMetadata.model';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { extractWaveform } from 'expo-waveform-extractor';

@injectable()
export class WaveformExtractionService {
  private recordedSubscription: Subscription | null = null;
  private isRunning = false;

  constructor(
    @inject(TOKENS.ICaptureMetadataRepository) private metadataRepository: ICaptureMetadataRepository,
    @inject('EventBus') private eventBus: EventBus
  ) {}

  /**
   * Start listening for CaptureRecorded events
   *
   * Call during app initialization to enable auto-extraction.
   * Idempotent: Calling multiple times has no effect.
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[WaveformExtractionService] Already running, ignoring start()');
      return;
    }

    // Subscribe to CaptureRecorded events
    this.recordedSubscription = this.eventBus.subscribe<CaptureRecordedEvent>(
      'CaptureRecorded',
      this.handleCaptureRecorded.bind(this)
    );

    this.isRunning = true;
    console.log('[WaveformExtractionService] ✅ Started listening for Capture events');
  }

  /**
   * Stop listening for events
   *
   * Call during app shutdown to cleanup resources.
   * Idempotent: Calling multiple times has no effect.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.recordedSubscription) {
      this.recordedSubscription.unsubscribe();
      this.recordedSubscription = null;
    }

    this.isRunning = false;
    console.log('[WaveformExtractionService] 🛑 Stopped listening');
  }

  /**
   * Extract waveform and save to metadata
   *
   * Public method that can be called by:
   * - Event listener (automatic after recording)
   * - WaveformPlayer (fallback for old captures)
   *
   * @param captureId - Capture ID for metadata storage
   * @param audioPath - Path to audio file
   * @param samplesPerPixel - Number of waveform samples (default: 50)
   * @returns Normalized waveform data (0-1 range) for display
   */
  async extractAndSave(
    captureId: string,
    audioPath: string,
    samplesPerPixel: number = 50
  ): Promise<number[]> {
    console.log('[WaveformExtractionService] 🎵 Extracting waveform for:', captureId);

    // 1. Extract raw RMS values
    const rawData = await extractWaveform({
      audioUri: audioPath,
      samplesPerPixel,
      playerKey: captureId,
    });

    console.log('[WaveformExtractionService] ✅ Extracted', rawData.length, 'samples');

    // 2. Save raw values to metadata (~300 bytes)
    await this.metadataRepository.setMany(captureId, [
      {
        key: METADATA_KEYS.WAVEFORM_DATA,
        value: JSON.stringify(rawData),
      },
    ]);

    console.log('[WaveformExtractionService] 💾 Saved waveform to metadata');

    // 3. Normalize for display (0-1 range)
    const maxValue = Math.max(...rawData);
    const normalizedData = maxValue > 0
      ? rawData.map(v => v / maxValue)
      : rawData;

    return normalizedData;
  }

  /**
   * Handle CaptureRecorded event
   *
   * Auto-extracts waveform for audio captures.
   */
  private async handleCaptureRecorded(event: CaptureRecordedEvent): Promise<void> {
    // Filter: Only process audio captures
    if (event.payload.captureType !== 'audio') {
      return;
    }

    const { captureId, audioPath } = event.payload;

    if (!audioPath) {
      console.warn('[WaveformExtractionService] No audio path in CaptureRecorded event:', captureId);
      return;
    }

    try {
      // Use shared method for extraction + save
      await this.extractAndSave(captureId, audioPath, 50);
    } catch (error) {
      // Log error but don't crash - waveform is non-critical
      console.error('[WaveformExtractionService] Failed to extract waveform:', error);
    }
  }
}
