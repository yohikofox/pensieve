import { AudioConversionService } from '../AudioConversionService';
import { decodeAudioData } from 'react-native-audio-api';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { useSettingsStore } from '../../../../stores/settingsStore';

// Mocks are set up in jest-setup.js

describe('AudioConversionService', () => {
  let service: AudioConversionService;

  beforeEach(() => {
    service = new AudioConversionService();
    jest.clearAllMocks();
    // Reset store to default (debug mode off)
    useSettingsStore.setState({ debugMode: false });
  });

  describe('convertToWhisperFormat', () => {
    it('should convert m4a to wav 16kHz mono', async () => {
      // Arrange
      const inputPath = '/path/to/recording.m4a';
      const expectedOutputPath = '/path/to/recording_whisper.wav';

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
      expect(decodeAudioData).toHaveBeenCalledWith(inputPath, 16000);
      expect(FileSystemLegacy.writeAsStringAsync).toHaveBeenCalledWith(
        expectedOutputPath,
        expect.any(String),
        expect.objectContaining({ encoding: 'base64' })
      );
    });

    it('should handle file:// URI prefix', async () => {
      // Arrange
      const inputPath = 'file:///path/to/recording.m4a';
      const expectedOutputPath = '/path/to/recording_whisper.wav';

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
    });

    it('should throw error if input file does not exist', async () => {
      // Arrange
      const inputPath = '/path/to/nonexistent.m4a';
      (FileSystemLegacy.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

      // Act & Assert
      await expect(service.convertToWhisperFormat(inputPath)).rejects.toThrow(
        `Audio file not found: ${inputPath}`
      );
      expect(decodeAudioData).not.toHaveBeenCalled();
    });

    it('should throw error if decoding fails', async () => {
      // Arrange
      const inputPath = '/path/to/recording.m4a';
      (decodeAudioData as jest.Mock).mockRejectedValueOnce(new Error('Decode failed'));

      // Act & Assert
      await expect(service.convertToWhisperFormat(inputPath)).rejects.toThrow(
        'Audio conversion failed: Decode failed'
      );
    });

    it('should handle files without extension', async () => {
      // Arrange
      const inputPath = '/path/to/recording';
      const expectedOutputPath = '/path/to/recording_whisper.wav';

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
    });
  });

  describe('cleanupTempFile', () => {
    beforeEach(() => {
      // Ensure debug mode is off for cleanup tests
      useSettingsStore.setState({ debugMode: false });
    });

    it('should delete temporary wav file', async () => {
      // Arrange
      const wavPath = '/path/to/recording_whisper.wav';

      // Act
      await service.cleanupTempFile(wavPath);

      // Assert
      expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(wavPath, {
        idempotent: true,
      });
    });

    it('should not throw if deletion fails', async () => {
      // Arrange
      const wavPath = '/path/to/recording_whisper.wav';
      (FileSystemLegacy.deleteAsync as jest.Mock).mockRejectedValueOnce(
        new Error('File not found')
      );

      // Act & Assert - should not throw
      await expect(service.cleanupTempFile(wavPath)).resolves.not.toThrow();
    });

    it('should skip deletion when debug mode is enabled', async () => {
      // Arrange - enable debug mode via store
      useSettingsStore.setState({ debugMode: true });
      const wavPath = '/path/to/recording_whisper.wav';

      // Act
      await service.cleanupTempFile(wavPath);

      // Assert
      expect(FileSystemLegacy.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('debug methods', () => {
    it('should track last converted WAV path', async () => {
      // Arrange
      const inputPath = '/path/to/recording.m4a';

      // Act
      await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(service.getLastConvertedWavPath()).toBe('/path/to/recording_whisper.wav');
    });

    it('should delete last converted WAV when requested', async () => {
      // Arrange
      const inputPath = '/path/to/recording.m4a';
      await service.convertToWhisperFormat(inputPath);

      // Act
      await service.deleteLastConvertedWav();

      // Assert
      expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(
        '/path/to/recording_whisper.wav',
        { idempotent: true }
      );
      expect(service.getLastConvertedWavPath()).toBeNull();
    });

    it('should handle delete when no WAV file exists', async () => {
      // Act & Assert - should not throw
      await expect(service.deleteLastConvertedWav()).resolves.not.toThrow();
      expect(FileSystemLegacy.deleteAsync).not.toHaveBeenCalled();
    });

    it('should read debug mode from settings store', () => {
      // Arrange - debug mode off
      useSettingsStore.setState({ debugMode: false });

      // Assert
      expect(service.isDebugModeEnabled()).toBe(false);

      // Arrange - debug mode on
      useSettingsStore.setState({ debugMode: true });

      // Assert
      expect(service.isDebugModeEnabled()).toBe(true);
    });
  });
});
