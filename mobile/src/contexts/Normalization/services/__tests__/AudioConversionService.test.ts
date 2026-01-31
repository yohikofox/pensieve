import { AudioConversionService } from "../AudioConversionService";
import { decodeAudioData } from "react-native-audio-api";
import { useSettingsStore } from "../../../../stores/settingsStore";
import { MockFileSystem } from "./MockFileSystem";

// Mocks are set up in jest-setup.js

describe("AudioConversionService", () => {
  let service: AudioConversionService;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    service = new AudioConversionService(mockFileSystem);
    jest.clearAllMocks();
    mockFileSystem.reset();
    // Reset store to default (debug mode off)
    useSettingsStore.setState({ debugMode: false });
  });

  describe("convertToWhisperFormat", () => {
    it("should convert m4a to wav 16kHz mono", async () => {
      // Arrange
      const inputPath = "/path/to/recording.m4a";
      const expectedOutputPath = "file:///test/cache/recording_whisper.wav"; // URI format for File constructor

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
      expect(decodeAudioData).toHaveBeenCalledWith(inputPath, 16000);
      expect(mockFileSystem.writeFileSpy).toHaveBeenCalledWith(
        expectedOutputPath,
        expect.any(String),
        'base64',
      );
    });

    it("should handle file:// URI prefix", async () => {
      // Arrange
      const inputPath = "file:///path/to/recording.m4a";
      const expectedOutputPath = "file:///test/cache/recording_whisper.wav";

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
    });

    it("should throw error if input file does not exist", async () => {
      // Arrange
      const inputPath = "/path/to/nonexistent.m4a";
      mockFileSystem.setFileInfo(inputPath, { exists: false });

      // Act & Assert
      await expect(service.convertToWhisperFormat(inputPath)).rejects.toThrow(
        `Audio file not found: ${inputPath}`,
      );
      expect(decodeAudioData).not.toHaveBeenCalled();
    });

    it("should throw error if decoding fails", async () => {
      // Arrange
      const inputPath = "/path/to/recording.m4a";
      (decodeAudioData as jest.Mock).mockRejectedValueOnce(
        new Error("Decode failed"),
      );

      // Act & Assert
      await expect(service.convertToWhisperFormat(inputPath)).rejects.toThrow(
        "Audio conversion failed: Decode failed",
      );
    });

    it("should handle files without extension", async () => {
      // Arrange
      const inputPath = "/path/to/recording";
      const expectedOutputPath = "file:///test/cache/recording_whisper.wav";

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(result).toBe(expectedOutputPath);
    });

    it("should return URI format (file://) for outputPath to work with expo-file-system File constructor", async () => {
      // Arrange: Bug reproduction - outputPath must have file:// prefix
      const inputPath = "/path/to/recording.m4a";

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert: outputPath MUST start with file:// for File constructor
      expect(result).toMatch(/^file:\/\//);

      // Verify writeFile was called with URI format
      expect(mockFileSystem.writeFileSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^file:\/\//),
        expect.any(String),
        'base64',
      );
    });

    it("should handle cache directory with file:// prefix", async () => {
      // Arrange: Simulate cache dir with file:// prefix
      mockFileSystem.setCacheDirectory("file:///test/cache");
      const inputPath = "/path/to/recording.m4a";

      // Act
      const result = await service.convertToWhisperFormat(inputPath);

      // Assert: output should have file:// prefix
      expect(result).toMatch(/^file:\/\//);
      expect(result).toContain("recording_whisper.wav");
    });
  });

  describe("cleanupTempFile", () => {
    beforeEach(() => {
      // Ensure debug mode is off for cleanup tests
      useSettingsStore.setState({ debugMode: false });
    });

    it("should delete temporary wav file", async () => {
      // Arrange
      const wavPath = "/path/to/recording_whisper.wav";

      // Act
      await service.cleanupTempFile(wavPath);

      // Assert
      expect(mockFileSystem.deleteFileSpy).toHaveBeenCalledWith(wavPath, {
        idempotent: true,
      });
    });

    it("should not throw if deletion fails", async () => {
      // Arrange
      const wavPath = "/path/to/recording_whisper.wav";
      // Mock deleteFile to reject without creating Error at parse time
      mockFileSystem.deleteFile = jest
        .fn()
        .mockRejectedValueOnce(Error("File not found"));

      // Act & Assert - should not throw
      await expect(service.cleanupTempFile(wavPath)).resolves.not.toThrow();
    });

    it("should skip deletion when debug mode is enabled", async () => {
      // Arrange - enable debug mode via store
      useSettingsStore.setState({ debugMode: true });
      const wavPath = "/path/to/recording_whisper.wav";

      // Act
      await service.cleanupTempFile(wavPath);

      // Assert
      expect(mockFileSystem.deleteFileSpy).not.toHaveBeenCalled();
    });
  });

  describe("debug methods", () => {
    it("should track last converted WAV path", async () => {
      // Arrange
      const inputPath = "/path/to/recording.m4a";

      // Act
      await service.convertToWhisperFormat(inputPath);

      // Assert
      expect(service.getLastConvertedWavPath()).toBe(
        "file:///test/cache/recording_whisper.wav",
      );
    });

    it("should delete last converted WAV when requested", async () => {
      // Arrange
      const inputPath = "/path/to/recording.m4a";
      await service.convertToWhisperFormat(inputPath);

      // Act
      await service.deleteLastConvertedWav();

      // Assert
      expect(mockFileSystem.deleteFileSpy).toHaveBeenCalledWith(
        "file:///test/cache/recording_whisper.wav",
        { idempotent: true },
      );
      expect(service.getLastConvertedWavPath()).toBeNull();
    });

    it("should handle delete when no WAV file exists", async () => {
      // Act & Assert - should not throw
      await expect(service.deleteLastConvertedWav()).resolves.not.toThrow();
      expect(mockFileSystem.deleteFileSpy).not.toHaveBeenCalled();
    });

    it("should read debug mode from settings store", () => {
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
