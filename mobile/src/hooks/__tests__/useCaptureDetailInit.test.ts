/**
 * Tests for useCaptureDetailInit hook
 *
 * Validates initialization logic consolidation:
 * - Capture loading
 * - Metadata loading
 * - Existing analyses loading
 * - Model availability check
 * - Engine type check
 */

import "reflect-metadata";

// Mock dependencies BEFORE imports
jest.mock("tsyringe");
jest.mock("../../contexts/Normalization/services/CaptureAnalysisService", () => ({
  CaptureAnalysisService: jest.fn(),
}));
jest.mock("../../contexts/Normalization/services/TranscriptionModelService", () => ({
  TranscriptionModelService: jest.fn(),
}));
jest.mock("../../contexts/Normalization/services/TranscriptionEngineService", () => ({
  TranscriptionEngineService: jest.fn(),
}));

import { renderHook, waitFor } from "@testing-library/react-native";
import { useCaptureDetailInit } from "../useCaptureDetailInit";
import { container } from "tsyringe";
import { TOKENS } from "../../infrastructure/di/tokens";
import type { Capture } from "../../contexts/capture/domain/Capture.model";

const mockCaptureRepository = {
  findById: jest.fn(),
};

const mockMetadataRepository = {
  getAllAsMap: jest.fn(),
};

const mockAnalysisService = {
  getAnalyses: jest.fn(),
};

const mockModelService = {
  getBestAvailableModel: jest.fn(),
};

const mockEngineService = {
  isNativeEngineSelected: jest.fn(),
};

describe("useCaptureDetailInit", () => {
  const mockCallbacks = {
    onCaptureLoaded: jest.fn(),
    onMetadataLoaded: jest.fn(),
    onLoadingChange: jest.fn(),
    onModelAvailabilityChange: jest.fn(),
    onEngineTypeChange: jest.fn(),
  };

  const mockCapture: Partial<Capture> = {
    id: "test-capture-id",
    type: "audio",
    state: "ready",
    normalizedText: "Test transcription",
  };

  const mockMetadata = {
    duration: { key: "duration", value: "120", captureId: "test-capture-id" },
  };

  const mockAnalyses = {
    summary: { type: "summary", content: "Test summary" },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup container.resolve mock
    (container.resolve as jest.Mock).mockImplementation((token) => {
      if (token === TOKENS.ICaptureRepository) return mockCaptureRepository;
      if (token === TOKENS.ICaptureMetadataRepository) return mockMetadataRepository;
      if (token.name === "CaptureAnalysisService") return mockAnalysisService;
      if (token.name === "TranscriptionModelService") return mockModelService;
      if (token.name === "TranscriptionEngineService") return mockEngineService;
      return null;
    });

    // Default successful responses
    mockCaptureRepository.findById.mockResolvedValue(mockCapture);
    mockMetadataRepository.getAllAsMap.mockResolvedValue(mockMetadata);
    mockAnalysisService.getAnalyses.mockResolvedValue(mockAnalyses);
    mockModelService.getBestAvailableModel.mockResolvedValue("whisper-tiny");
    mockEngineService.isNativeEngineSelected.mockResolvedValue(false);
  });

  describe("Successful initialization", () => {
    it("should load capture and metadata successfully", async () => {
      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify capture was loaded
      expect(mockCaptureRepository.findById).toHaveBeenCalledWith("test-capture-id");
      expect(mockCallbacks.onCaptureLoaded).toHaveBeenCalledWith(mockCapture);

      // Verify metadata was loaded
      expect(mockMetadataRepository.getAllAsMap).toHaveBeenCalledWith("test-capture-id");
      expect(mockCallbacks.onMetadataLoaded).toHaveBeenCalledWith(mockMetadata);

      // Verify loading state was updated
      expect(mockCallbacks.onLoadingChange).toHaveBeenCalledWith(true);
      expect(mockCallbacks.onLoadingChange).toHaveBeenCalledWith(false);

      // No error
      expect(result.current.error).toBeNull();
    });

    it("should load existing analyses", async () => {
      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.existingAnalyses).toEqual(mockAnalyses);
      });

      expect(mockAnalysisService.getAnalyses).toHaveBeenCalledWith("test-capture-id");
    });

    it("should check model availability", async () => {
      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.hasModelAvailable).toBe(true);
      });

      expect(mockModelService.getBestAvailableModel).toHaveBeenCalled();
      expect(mockCallbacks.onModelAvailabilityChange).toHaveBeenCalledWith(true);
    });

    it("should check engine type", async () => {
      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.isNativeEngine).toBe(false);
      });

      expect(mockEngineService.isNativeEngineSelected).toHaveBeenCalled();
      expect(mockCallbacks.onEngineTypeChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Error handling", () => {
    it("should handle capture loading error", async () => {
      const error = new Error("Failed to load capture");
      mockCaptureRepository.findById.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(mockCallbacks.onCaptureLoaded).toHaveBeenCalledWith(null);
    });

    it("should handle model availability check failure", async () => {
      mockModelService.getBestAvailableModel.mockRejectedValue(
        new Error("Model check failed")
      );

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.hasModelAvailable).toBe(null);
      });

      expect(mockCallbacks.onModelAvailabilityChange).toHaveBeenCalledWith(null);
    });

    it("should handle engine type check failure", async () => {
      mockEngineService.isNativeEngineSelected.mockRejectedValue(
        new Error("Engine check failed")
      );

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.isNativeEngine).toBe(false);
      });

      expect(mockCallbacks.onEngineTypeChange).toHaveBeenCalledWith(false);
    });

    it("should handle analyses loading failure gracefully", async () => {
      mockAnalysisService.getAnalyses.mockRejectedValue(
        new Error("Analyses load failed")
      );

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      // Should not crash, existingAnalyses remains null
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.existingAnalyses).toBeNull();
    });
  });

  describe("Model availability variations", () => {
    it("should set hasModelAvailable to false when no model found", async () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.hasModelAvailable).toBe(false);
      });

      expect(mockCallbacks.onModelAvailabilityChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Engine type variations", () => {
    it("should set isNativeEngine to true when native engine selected", async () => {
      mockEngineService.isNativeEngineSelected.mockResolvedValue(true);

      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.isNativeEngine).toBe(true);
      });

      expect(mockCallbacks.onEngineTypeChange).toHaveBeenCalledWith(true);
    });
  });

  describe("loadCapture function", () => {
    it("should expose loadCapture function for manual reload", async () => {
      const { result } = renderHook(() =>
        useCaptureDetailInit({
          captureId: "test-capture-id",
          ...mockCallbacks,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear previous calls
      jest.clearAllMocks();

      // Call loadCapture manually
      await result.current.loadCapture();

      // Verify it reloads capture and metadata
      expect(mockCaptureRepository.findById).toHaveBeenCalledWith("test-capture-id");
      expect(mockMetadataRepository.getAllAsMap).toHaveBeenCalledWith("test-capture-id");
    });
  });
});
