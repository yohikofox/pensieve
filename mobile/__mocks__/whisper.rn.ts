/**
 * Manual mock for whisper.rn
 *
 * Provides Jest-compatible mocks for Whisper transcription operations
 * Matches the whisper.rn API structure with WhisperContext
 */

// Mock WhisperContext class
export class WhisperContext {
  id: number;
  gpu: boolean = false;
  reasonNoGPU: string = '';

  constructor(options?: { contextId?: number; gpu?: boolean }) {
    this.id = options?.contextId ?? Math.floor(Math.random() * 10000);
    this.gpu = options?.gpu ?? false;
  }

  transcribe = jest.fn((filePath: string, options?: any) => ({
    stop: jest.fn().mockResolvedValue(undefined),
    promise: Promise.resolve({
      result: 'Mocked transcription result',
      segments: [],
      isAborted: false,
    }),
  }));

  release = jest.fn().mockResolvedValue(undefined);
}

// Mock initWhisper function
export const initWhisper = jest.fn(async (options: { filePath: string; useGpu?: boolean }) => {
  return new WhisperContext({
    contextId: Math.floor(Math.random() * 10000),
    gpu: options.useGpu ?? true,
  });
});

// Mock releaseAllWhisper function
export const releaseAllWhisper = jest.fn().mockResolvedValue(undefined);

// Legacy exports for backward compatibility
export const releaseWhisper = jest.fn().mockResolvedValue(undefined);
export const transcribe = jest.fn();

const whisperRn = {
  initWhisper,
  releaseAllWhisper,
  releaseWhisper,
  transcribe,
  WhisperContext,
};

export default whisperRn;
