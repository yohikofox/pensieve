import { requireNativeModule } from 'expo-modules-core';

const ExpoWaveformExtractorModule = requireNativeModule('ExpoWaveformExtractorModule');

export interface WaveformProgressEvent {
  progress: number;
  waveformData: number[];
  playerKey: string;
}

export interface ExtractWaveformOptions {
  audioUri: string;
  samplesPerPixel?: number;
  playerKey?: string;
  onProgress?: (event: WaveformProgressEvent) => void;
}

/**
 * Extract waveform data from audio file
 *
 * @param options - Extraction options
 * @returns Promise<number[]> - Array of RMS amplitude values
 *
 * @example
 * ```ts
 * const waveform = await extractWaveform({
 *   audioUri: 'file:///path/to/audio.m4a',
 *   samplesPerPixel: 50,
 *   onProgress: (event) => {
 *     console.log(`Progress: ${event.progress * 100}%`);
 *   }
 * });
 * ```
 */
export async function extractWaveform(
  options: ExtractWaveformOptions
): Promise<number[]> {
  const {
    audioUri,
    samplesPerPixel = 50,
    playerKey = 'default',
    // onProgress not implemented yet - would need EventEmitter setup
  } = options;

  const result = await ExpoWaveformExtractorModule.extractWaveform(
    audioUri,
    samplesPerPixel,
    playerKey
  );

  // Result can be array directly or wrapped in object
  const waveformData = Array.isArray(result) ? result : result.waveformData;

  return waveformData;
}

/**
 * Cancel ongoing waveform extraction
 *
 * @param playerKey - Key of the extraction to cancel
 */
export async function cancelExtraction(playerKey: string = 'default'): Promise<void> {
  return ExpoWaveformExtractorModule.cancelExtraction(playerKey);
}
