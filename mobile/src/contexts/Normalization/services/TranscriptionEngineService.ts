/**
 * Transcription Engine Service
 *
 * Manages the selection and switching between transcription engines.
 * Stores user preference and provides the appropriate engine.
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ITranscriptionEngine,
  TranscriptionEngineType,
} from './ITranscriptionEngine';
import { NativeTranscriptionEngine } from './NativeTranscriptionEngine';

const STORAGE_KEY = '@pensieve/transcription_engine';

export interface TranscriptionEngineInfo {
  type: TranscriptionEngineType;
  displayName: string;
  description: string;
  supportsRealTime: boolean;
  supportsOffline: boolean;
  isAvailable: boolean;
}

@injectable()
export class TranscriptionEngineService {
  private nativeEngine: NativeTranscriptionEngine;
  private currentEngineType: TranscriptionEngineType = 'whisper';

  constructor(
    @inject(NativeTranscriptionEngine) nativeEngine: NativeTranscriptionEngine
  ) {
    this.nativeEngine = nativeEngine;
  }

  /**
   * Get the currently selected engine type
   */
  async getSelectedEngineType(): Promise<TranscriptionEngineType> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'native' || stored === 'whisper') {
        this.currentEngineType = stored;
        return stored;
      }
    } catch (error) {
      console.error('[TranscriptionEngineService] Failed to get preference:', error);
    }
    return 'whisper'; // Default to Whisper
  }

  /**
   * Set the transcription engine preference
   */
  async setSelectedEngineType(type: TranscriptionEngineType): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, type);
      this.currentEngineType = type;
      console.log('[TranscriptionEngineService] Engine set to:', type);
    } catch (error) {
      console.error('[TranscriptionEngineService] Failed to save preference:', error);
      throw error;
    }
  }

  /**
   * Get list of available engines with their info
   */
  async getAvailableEngines(): Promise<TranscriptionEngineInfo[]> {
    const nativeAvailable = await this.nativeEngine.isAvailable();

    return [
      {
        type: 'whisper',
        displayName: 'Whisper (OpenAI)',
        description: 'Haute précision, fonctionne hors-ligne. Nécessite le téléchargement du modèle.',
        supportsRealTime: false,
        supportsOffline: true,
        isAvailable: true, // Whisper is always available if model is downloaded
      },
      {
        type: 'native',
        displayName: 'Reconnaissance native',
        description: 'Transcription temps réel, accéléré par le hardware. Sur les appareils récents, fonctionne hors-ligne.',
        supportsRealTime: true,
        supportsOffline: true, // On modern devices
        isAvailable: nativeAvailable,
      },
    ];
  }

  /**
   * Get the native transcription engine
   */
  getNativeEngine(): NativeTranscriptionEngine {
    return this.nativeEngine;
  }

  /**
   * Check if native engine is the selected one
   */
  async isNativeEngineSelected(): Promise<boolean> {
    const type = await this.getSelectedEngineType();
    return type === 'native';
  }

  /**
   * Check if native engine is available
   */
  async isNativeEngineAvailable(): Promise<boolean> {
    return this.nativeEngine.isAvailable();
  }
}
