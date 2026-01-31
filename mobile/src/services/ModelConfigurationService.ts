/**
 * ModelConfigurationService - Singleton service for Whisper model management
 *
 * Manages Whisper model configuration, detection, and persistence (Story 2.7)
 *
 * @see AC1: Detect Missing Model Before Transcription Attempt
 * @see AC7: Persistent Model Configuration Across App Restarts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { EventEmitter } from 'events';

export type ModelStatus = 'available' | 'downloading' | 'not_configured';

const STORAGE_KEYS = {
  MODEL_PATH: 'whisper_model_path',
  MODEL_STATUS: 'whisper_model_status',
} as const;

/**
 * Singleton service for managing Whisper model configuration
 *
 * Responsibilities:
 * - Detect if model is available (AC1)
 * - Persist model configuration across app restarts (AC7)
 * - Emit events when model becomes available (AC6)
 * - Cache model status for fast checks (<100ms - NFR1)
 */
export class ModelConfigurationService {
  private static instance: ModelConfigurationService;
  private modelPath: string | null = null;
  private modelStatus: ModelStatus = 'not_configured';
  private eventEmitter = new EventEmitter();

  private constructor() {
    // Private constructor for singleton pattern
    this.loadConfiguration();
  }

  /**
   * Get singleton instance of ModelConfigurationService
   */
  public static getInstance(): ModelConfigurationService {
    if (!ModelConfigurationService.instance) {
      ModelConfigurationService.instance = new ModelConfigurationService();
    }
    return ModelConfigurationService.instance;
  }

  /**
   * Check if Whisper model is available and ready for transcription
   *
   * Performance requirement: < 100ms (NFR1 - AC1)
   *
   * @returns Promise<boolean> - true if model exists and is ready
   */
  public async isModelAvailable(): Promise<boolean> {
    // Fast check using cached status
    if (this.modelStatus !== 'available') {
      return false;
    }

    if (!this.modelPath) {
      return false;
    }

    // Verify file still exists (quick filesystem check)
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.modelPath);
      return fileInfo.exists;
    } catch (error) {
      console.warn('Model file check failed:', error);
      return false;
    }
  }

  /**
   * Get current model status
   *
   * @returns Promise<ModelStatus> - 'available', 'downloading', or 'not_configured'
   */
  public async getModelStatus(): Promise<ModelStatus> {
    // If status is 'available', verify file still exists
    if (this.modelStatus === 'available' && this.modelPath) {
      const fileExists = await this.isModelAvailable();
      if (!fileExists) {
        // File was deleted - reset status
        this.modelStatus = 'not_configured';
        await this.clearModel();
      }
    }

    return this.modelStatus;
  }

  /**
   * Get configured model file path
   *
   * @returns string | null - Model file path or null if not configured
   */
  public getModelPath(): string | null {
    return this.modelPath;
  }

  /**
   * Set model path and update status
   *
   * Persists configuration to AsyncStorage (AC7)
   *
   * @param path - Filesystem path to Whisper model file
   * @param status - Model status ('available', 'downloading', etc.)
   */
  public async setModelPath(path: string, status: ModelStatus = 'available'): Promise<void> {
    this.modelPath = path;
    this.modelStatus = status;

    // Persist to AsyncStorage (AC7)
    await AsyncStorage.setItem(STORAGE_KEYS.MODEL_PATH, path);
    await AsyncStorage.setItem(STORAGE_KEYS.MODEL_STATUS, status);

    // Emit event if model became available (AC6)
    if (status === 'available') {
      this.eventEmitter.emit('model_available', path);
    }
  }

  /**
   * Clear model configuration and reset status
   */
  public async clearModel(): Promise<void> {
    this.modelPath = null;
    this.modelStatus = 'not_configured';

    await AsyncStorage.removeItem(STORAGE_KEYS.MODEL_PATH);
    await AsyncStorage.removeItem(STORAGE_KEYS.MODEL_STATUS);
  }

  /**
   * Register listener for model availability events (AC6)
   *
   * @param callback - Function to call when model becomes available
   */
  public onModelAvailable(callback: (modelPath: string) => void): void {
    this.eventEmitter.on('model_available', callback);
  }

  /**
   * Remove listener for model availability events
   *
   * @param callback - Function to remove from listeners
   */
  public offModelAvailable(callback: (modelPath: string) => void): void {
    this.eventEmitter.off('model_available', callback);
  }

  /**
   * Load model configuration from AsyncStorage on initialization (AC7)
   *
   * Runs automatically in constructor to restore persisted config
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const [path, status] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_PATH),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_STATUS),
      ]);

      if (path) {
        this.modelPath = path;
      }

      if (status) {
        this.modelStatus = status as ModelStatus;
      }
    } catch (error) {
      console.warn('Failed to load model configuration from AsyncStorage:', error);
      // Default to not_configured on error
      this.modelPath = null;
      this.modelStatus = 'not_configured';
    }
  }
}
