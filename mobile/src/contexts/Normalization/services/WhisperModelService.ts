import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';

export type WhisperModelSize = 'tiny' | 'base';

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-1
}

/**
 * Service to manage Whisper model download and storage
 *
 * Uses Expo SDK 54 modern APIs:
 * - expo/fetch with ReadableStream for progress tracking
 * - expo-file-system File/Directory classes for storage
 *
 * Responsibilities:
 * - Download Whisper models (tiny, base) from remote URL
 * - Store models in secure app directory
 * - Track download progress
 * - Validate model existence
 * - Handle download failures
 */
export class WhisperModelService {
  private readonly MODEL_BASE_URL =
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

  private readonly MODEL_CONFIGS = {
    tiny: {
      filename: 'ggml-tiny.bin',
      expectedSize: 75 * 1024 * 1024, // ~75MB
    },
    base: {
      filename: 'ggml-base.bin',
      expectedSize: 142 * 1024 * 1024, // ~142MB
    },
  };

  /**
   * Download Whisper model to device storage with progress tracking
   *
   * Uses expo/fetch with ReadableStream for progress callbacks
   *
   * @param modelSize - 'tiny' or 'base'
   * @param onProgress - Callback for download progress updates
   * @returns Path to downloaded model file
   * @throws Error if download fails or model size unsupported
   */
  async downloadModel(
    modelSize: WhisperModelSize,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const config = this.MODEL_CONFIGS[modelSize];
    if (!config) {
      throw new Error(`Unsupported model size: ${modelSize}`);
    }

    const modelUrl = `${this.MODEL_BASE_URL}/${config.filename}`;
    const modelFile = this.getModelFile(modelSize);

    console.log('[WhisperModelService] 📥 Starting download:', {
      modelUrl,
      modelPath: modelFile.uri,
    });

    try {
      // Fetch with streaming support
      const response = await fetch(modelUrl, {
        headers: {
          'User-Agent': 'Pensieve-App/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      // Get content length for progress calculation
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : config.expectedSize;

      console.log('[WhisperModelService] 📊 Content-Length:', totalBytes);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Read stream with progress tracking
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        // Report progress
        if (onProgress) {
          const progress = receivedBytes / totalBytes;
          onProgress({
            totalBytesWritten: receivedBytes,
            totalBytesExpectedToWrite: totalBytes,
            progress: Math.min(progress, 1), // Cap at 1 in case content-length was wrong
          });

          // Log progress every ~10%
          if (Math.floor(progress * 10) !== Math.floor((receivedBytes - value.length) / totalBytes * 10)) {
            console.log('[WhisperModelService] 📊 Progress:', {
              written: receivedBytes,
              total: totalBytes,
              percent: Math.round(progress * 100),
            });
          }
        }
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // Write to file using new expo-file-system API
      await modelFile.write(fileData);

      console.log('[WhisperModelService] ✅ Download completed:', modelFile.uri);

      return modelFile.uri;
    } catch (error) {
      console.error('[WhisperModelService] ❌ Download failed:', error);
      throw new Error(
        `Failed to download ${modelSize} model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a model is already downloaded
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns true if model exists
   */
  async isModelDownloaded(modelSize: WhisperModelSize): Promise<boolean> {
    const modelFile = this.getModelFile(modelSize);
    return modelFile.exists;
  }

  /**
   * Get the File instance for a model
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns File instance for the model
   */
  private getModelFile(modelSize: WhisperModelSize): File {
    const filename = `whisper-${modelSize}.bin`;
    return new File(Paths.document, filename);
  }

  /**
   * Get the local file path for a model
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Absolute path to model file in document directory
   */
  getModelPath(modelSize: WhisperModelSize): string {
    return this.getModelFile(modelSize).uri;
  }

  /**
   * Delete a downloaded model
   *
   * @param modelSize - 'tiny' or 'base'
   * @throws Error if deletion fails
   */
  async deleteModel(modelSize: WhisperModelSize): Promise<void> {
    const modelFile = this.getModelFile(modelSize);
    try {
      if (modelFile.exists) {
        await modelFile.delete();
      }
    } catch (error) {
      throw new Error(
        `Failed to delete ${modelSize} model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get download URL for a model (for debugging/logging)
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Full URL to download the model
   */
  getModelUrl(modelSize: WhisperModelSize): string {
    const config = this.MODEL_CONFIGS[modelSize];
    return `${this.MODEL_BASE_URL}/${config.filename}`;
  }

  /**
   * Get expected model size in bytes
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Expected file size in bytes
   */
  getExpectedSize(modelSize: WhisperModelSize): number {
    return this.MODEL_CONFIGS[modelSize].expectedSize;
  }

  /**
   * Download model with automatic retry and exponential backoff
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: After 5 seconds
   * - Attempt 3: After 30 seconds
   * - Attempt 4: After 5 minutes
   * - Total: 3 retries, then fail
   *
   * @param modelSize - 'tiny' or 'base'
   * @param onProgress - Optional progress callback
   * @returns Path to downloaded model
   * @throws Error after 3 failed retry attempts
   */
  async downloadModelWithRetry(
    modelSize: WhisperModelSize,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const retryDelays = [5000, 30000, 5 * 60 * 1000]; // 5s, 30s, 5min
    let lastError: Error | null = null;

    // Initial attempt
    try {
      return await this.downloadModel(modelSize, onProgress);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }

    // Retry attempts with exponential backoff
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      const delay = retryDelays[attempt];

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        return await this.downloadModel(modelSize, onProgress);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    // All retries failed
    throw lastError!;
  }
}
