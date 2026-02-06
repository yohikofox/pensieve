/**
 * Specialized hooks for commonly used services
 * Provides convenient access to frequently used dependencies
 */
import { useMemo } from 'react';
import { TOKENS } from '../infrastructure/di/tokens';
import { useDI, useOptionalDI } from './useDI';
import type { ICaptureRepository } from '../contexts/capture/domain/ICaptureRepository';
import { TranscriptionQueueService } from '../contexts/Normalization/services/TranscriptionQueueService';
import { TranscriptionModelService } from '../contexts/Normalization/services/TranscriptionModelService';
import { TranscriptionEngineService } from '../contexts/Normalization/services/TranscriptionEngineService';

/**
 * Hook to access the Capture Repository
 *
 * @example
 * const captureRepo = useCaptureRepository();
 * await captureRepo.save(capture);
 */
export function useCaptureRepository(): ICaptureRepository {
  return useDI<ICaptureRepository>(TOKENS.ICaptureRepository);
}

/**
 * Hook to access the Transcription Queue Service
 *
 * @example
 * const queueService = useTranscriptionQueue();
 * await queueService.enqueue({ captureId, audioPath });
 */
export function useTranscriptionQueue(): TranscriptionQueueService {
  return useDI(TranscriptionQueueService);
}

/**
 * Hook to access the Transcription Model Service
 *
 * @example
 * const modelService = useTranscriptionModel();
 * const bestModel = await modelService.getBestAvailableModel();
 */
export function useTranscriptionModel(): TranscriptionModelService {
  return useMemo(() => new TranscriptionModelService(), []);
}

/**
 * Hook to access the Transcription Engine Service
 *
 * @example
 * const engineService = useTranscriptionEngine();
 * const selectedEngine = await engineService.getSelectedEngineType();
 */
export function useTranscriptionEngine(): TranscriptionEngineService {
  return useDI(TranscriptionEngineService);
}

/**
 * Hook to access the optional Sync Service (Epic 6)
 *
 * @example
 * const syncService = useSyncService();
 *
 * if (syncService && !isOffline) {
 *   await syncService.syncCaptures();
 * }
 */
export function useSyncService(): any | null {
  return useOptionalDI<any>(TOKENS.ISyncService);
}
