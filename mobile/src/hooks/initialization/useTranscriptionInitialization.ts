import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ILogger } from '../../infrastructure/logging/ILogger';
import { TranscriptionQueueProcessor } from '../../contexts/Normalization/processors/TranscriptionQueueProcessor';
import { TranscriptionWorker } from '../../contexts/Normalization/workers/TranscriptionWorker';
import { WaveformExtractionService } from '../../contexts/capture/services/WaveformExtractionService';
import { registerTranscriptionBackgroundTask } from '../../contexts/Normalization/tasks/transcriptionBackgroundTask';

// Lazy logger resolution - only resolve when hook is called, not at module load time
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('TranscriptionInit');

/**
 * Transcription Services Initialization
 *
 * Initializes and manages:
 * - Queue processor (auto-enqueue captures)
 * - Waveform extraction (auto-extract on capture)
 * - Transcription worker (process queue)
 * - Background task (15-min periodic checks)
 * - App lifecycle handling (pause/resume on background/foreground)
 *
 * Story: 2.5 - Transcription Services
 */
export function useTranscriptionInitialization() {
  useEffect(() => {
    const queueProcessor = container.resolve(TranscriptionQueueProcessor);
    const waveformService = container.resolve(WaveformExtractionService);
    const worker = container.resolve(TranscriptionWorker);
    let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

    initializeTranscription(queueProcessor, waveformService, worker, (listener) => {
      appStateListener = listener;
    });

    return () => {
      const log = getLogger();
      log.debug("Cleaning up transcription services...");
      queueProcessor.stop();
      waveformService.stop();
      worker.stop();
      appStateListener?.remove();
    };
  }, []);
}

async function initializeTranscription(
  queueProcessor: TranscriptionQueueProcessor,
  waveformService: WaveformExtractionService,
  worker: TranscriptionWorker,
  setAppStateListener: (listener: ReturnType<typeof AppState.addEventListener>) => void
) {
  const log = getLogger();
  try {
    log.debug("Initializing transcription services...");

    queueProcessor.start();
    log.debug("✅ TranscriptionQueueProcessor started");

    waveformService.start();
    log.debug("✅ WaveformExtractionService started");

    await worker.start();
    log.debug("✅ TranscriptionWorker started");

    await registerTranscriptionBackgroundTask();
    log.debug("✅ Background transcription task registered");

    const listener = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (nextAppState === "background") {
          log.debug("App backgrounding - pausing transcription worker");
          await worker.pause();
        } else if (nextAppState === "active") {
          log.debug("App foregrounding - resuming transcription worker");
          await worker.resume();
        }
      }
    );

    setAppStateListener(listener);
  } catch (error) {
    log.error("Transcription services initialization failed:", error);
  }
}
