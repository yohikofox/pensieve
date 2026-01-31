/**
 * ModelConfigurationService - Unit Tests
 *
 * Tests model detection, persistence, and status management (Story 2.7 - Task 1)
 *
 * @see ModelConfigurationService.ts
 * @see AC1: Detect Missing Model Before Transcription Attempt
 * @see AC7: Persistent Model Configuration Across App Restarts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ModelConfigurationService, ModelStatus } from '../ModelConfigurationService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/document/',
  getInfoAsync: jest.fn(),
}));

describe('ModelConfigurationService', () => {
  let service: ModelConfigurationService;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset AsyncStorage state
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Reset FileSystem state
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    // Create fresh service instance
    service = ModelConfigurationService.getInstance();

    // Reset singleton state by clearing storage and reloading
    await service.clearModel();
    await service['loadConfiguration']();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = ModelConfigurationService.getInstance();
      const instance2 = ModelConfigurationService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Task 1.1: isModelAvailable() - Model Detection', () => {
    it('should return false when no model is configured', async () => {
      const available = await service.isModelAvailable();

      expect(available).toBe(false);
    });

    it('should return true when model file exists and is configured', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      // Mock AsyncStorage to return configured path
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      // Mock file exists
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 500 * 1024 * 1024, // 500 MB
      });

      // Reload configuration
      await service['loadConfiguration']();

      const available = await service.isModelAvailable();

      expect(available).toBe(true);
    });

    it('should return false when model configured but file does not exist', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      // Model configured in AsyncStorage
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      // But file does not exist
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await service['loadConfiguration']();

      const available = await service.isModelAvailable();

      expect(available).toBe(false);
    });
  });

  describe('Task 1.2: getModelStatus() - Status Detection', () => {
    it('should return "not_configured" when no model set', async () => {
      const status = await service.getModelStatus();

      expect(status).toBe('not_configured');
    });

    it('should return "available" when model exists', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 500 * 1024 * 1024,
      });

      await service['loadConfiguration']();

      const status = await service.getModelStatus();

      expect(status).toBe('available');
    });

    it('should return "downloading" when download in progress', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_status') return Promise.resolve('downloading');
        return Promise.resolve(null);
      });

      await service['loadConfiguration']();

      const status = await service.getModelStatus();

      expect(status).toBe('downloading');
    });
  });

  describe('Task 1.1: getModelPath() - Path Retrieval', () => {
    it('should return null when no model configured', () => {
      const path = service.getModelPath();

      expect(path).toBeNull();
    });

    it('should return configured path when model available', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      await service['loadConfiguration']();

      const path = service.getModelPath();

      expect(path).toBe(modelPath);
    });
  });

  describe('Task 1.3: Persistence - Save and Load Configuration', () => {
    it('should persist model path to AsyncStorage when set', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      await service.setModelPath(modelPath, 'available');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('whisper_model_path', modelPath);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('whisper_model_status', 'available');
    });

    it('should load persisted configuration on initialization', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      // Configure mocks BEFORE loading
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 500 * 1024 * 1024,
      });

      // Reload configuration with new mocks
      await service['loadConfiguration']();

      const path = service.getModelPath();
      expect(path).toBe(modelPath);

      const status = await service.getModelStatus();
      expect(status).toBe('available');
    });

    it('should clear model configuration when reset', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      await service.setModelPath(modelPath, 'available');
      await service.clearModel();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('whisper_model_path');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('whisper_model_status');

      const path = service.getModelPath();
      expect(path).toBeNull();

      const status = await service.getModelStatus();
      expect(status).toBe('not_configured');
    });
  });

  describe('Performance: Model check < 100ms (NFR1)', () => {
    it('should complete model availability check in < 100ms', async () => {
      const startTime = Date.now();

      await service.isModelAvailable();

      const elapsed = Date.now() - startTime;

      // Should be very fast (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });

    it('should use cached status for fast checks', async () => {
      const modelPath = `${FileSystem.documentDirectory}models/whisper-base.bin`;

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'whisper_model_path') return Promise.resolve(modelPath);
        if (key === 'whisper_model_status') return Promise.resolve('available');
        return Promise.resolve(null);
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 500 * 1024 * 1024,
      });

      await service['loadConfiguration']();

      // First check loads from storage
      await service.isModelAvailable();

      // Second check should use cache
      const startTime = Date.now();
      await service.isModelAvailable();
      const elapsed = Date.now() - startTime;

      // Cached check should be extremely fast
      expect(elapsed).toBeLessThan(10);
    });
  });
});
