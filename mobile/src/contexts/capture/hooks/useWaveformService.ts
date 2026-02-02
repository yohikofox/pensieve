/**
 * Hook to access WaveformExtractionService
 *
 * Provides access to waveform extraction service with proper DI resolution.
 * Uses singleton pattern to ensure same instance across component lifecycle.
 */

import { useRef } from 'react';
import { container } from 'tsyringe';
import { WaveformExtractionService } from '../services/WaveformExtractionService';

/**
 * Access waveform extraction service
 *
 * Returns singleton instance of WaveformExtractionService with properly
 * injected dependencies (CaptureMetadataRepository, EventBus).
 */
export function useWaveformService(): WaveformExtractionService {
  const serviceRef = useRef<WaveformExtractionService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = container.resolve(WaveformExtractionService);
  }

  return serviceRef.current;
}
