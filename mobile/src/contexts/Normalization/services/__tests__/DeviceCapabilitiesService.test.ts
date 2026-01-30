/**
 * DeviceCapabilitiesService - Device Detection Tests
 *
 * Story 2.5 - Task 7.3: Device-specific optimizations
 *
 * Tests for:
 * - Device tier detection (high-end, mid-range, low-end)
 * - Whisper model recommendations
 * - Performance warnings for low-end devices
 */

import 'reflect-metadata';
import { DeviceCapabilitiesService, type DeviceTier } from '../DeviceCapabilitiesService';
import { NPUDetectionService, type NPUInfo } from '../NPUDetectionService';
import { Platform } from 'react-native';

// Mock NPUDetectionService
class MockNPUDetectionService {
  private mockInfo: NPUInfo | null = null;

  setMockInfo(info: NPUInfo) {
    this.mockInfo = info;
  }

  async detectNPU(): Promise<NPUInfo> {
    return this.mockInfo || {
      hasNPU: false,
      type: 'none',
      generation: 'none',
      deviceModel: 'Unknown',
      manufacturer: 'other',
      isRecommendedForLLM: false,
    };
  }

  async hasNPU(): Promise<boolean> {
    const info = await this.detectNPU();
    return info.hasNPU;
  }
}

// Helper to mock Platform.OS
function mockPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    get: () => os,
    configurable: true,
  });
}

describe('DeviceCapabilitiesService', () => {
  let service: DeviceCapabilitiesService;
  let mockNPUService: MockNPUDetectionService;

  beforeEach(() => {
    // Reset to default iOS (matches jest-setup.js)
    mockPlatformOS('ios');
    mockNPUService = new MockNPUDetectionService();
    service = new DeviceCapabilitiesService(mockNPUService as any);
  });

  describe('detectCapabilities()', () => {
    it('should detect high-end iOS device (A17 Pro)', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A17 Pro',
        deviceModel: 'iPhone15,2',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('high-end');
      expect(capabilities.recommendedWhisperModel).toBe('base');
      expect(capabilities.hasAcceleration).toBe(true);
      expect(capabilities.shouldWarnPerformance).toBe(false);
    });

    it('should detect mid-range iOS device (A14)', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A14 Bionic',
        deviceModel: 'iPhone13,2',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('mid-range');
      expect(capabilities.recommendedWhisperModel).toBe('tiny');
      expect(capabilities.hasAcceleration).toBe(true);
      expect(capabilities.shouldWarnPerformance).toBe(false);
    });

    it('should detect low-end iOS device (A12)', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A12 Bionic',
        deviceModel: 'iPhone11,2',
        manufacturer: 'apple',
        isRecommendedForLLM: false,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('low-end');
      expect(capabilities.recommendedWhisperModel).toBe('tiny');
      expect(capabilities.hasAcceleration).toBe(true);
      expect(capabilities.shouldWarnPerformance).toBe(true);
      expect(capabilities.performanceWarning).toContain('capacités limitées');
    });

    it('should detect high-end Android device (Pixel 9)', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'tensor-tpu',
        generation: 'Tensor G4',
        deviceModel: 'Pixel 9 Pro',
        manufacturer: 'google',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('high-end');
      expect(capabilities.recommendedWhisperModel).toBe('base');
      expect(capabilities.hasAcceleration).toBe(true);
      expect(capabilities.shouldWarnPerformance).toBe(false);
    });

    it('should detect mid-range Android device (Pixel 7)', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'tensor-tpu',
        generation: 'Tensor G2',
        deviceModel: 'Pixel 7',
        manufacturer: 'google',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('mid-range');
      expect(capabilities.recommendedWhisperModel).toBe('tiny');
      expect(capabilities.hasAcceleration).toBe(true);
    });

    it('should detect low-end Android device without NPU', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: false,
        type: 'none',
        generation: 'none',
        deviceModel: 'Generic Device',
        manufacturer: 'other',
        isRecommendedForLLM: false,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('low-end');
      expect(capabilities.recommendedWhisperModel).toBe('tiny');
      expect(capabilities.hasAcceleration).toBe(false);
      expect(capabilities.shouldWarnPerformance).toBe(true);
    });

    it('should detect high-end Samsung device', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'samsung-npu',
        generation: 'Exynos 2400',
        deviceModel: 'SM-S921B',
        manufacturer: 'samsung',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.tier).toBe('high-end');
      expect(capabilities.recommendedWhisperModel).toBe('base');
    });
  });

  describe('Whisper Model Recommendations', () => {
    it('should recommend base model for high-end devices', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A16 Bionic',
        deviceModel: 'iPhone14,2',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.recommendedWhisperModel).toBe('base');
    });

    it('should recommend tiny model for mid-range devices', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'tensor-tpu',
        generation: 'Tensor G1',
        deviceModel: 'Pixel 6',
        manufacturer: 'google',
        isRecommendedForLLM: false,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.recommendedWhisperModel).toBe('tiny');
    });

    it('should recommend tiny model for low-end devices', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: false,
        type: 'none',
        generation: 'none',
        deviceModel: 'Budget Phone',
        manufacturer: 'other',
        isRecommendedForLLM: false,
      });

      const capabilities = await service.detectCapabilities();

      expect(capabilities.recommendedWhisperModel).toBe('tiny');
    });
  });

  describe('Performance Warnings', () => {
    it('should NOT warn for high-end devices', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A18',
        deviceModel: 'iPhone17,1',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const shouldWarn = await service.shouldShowPerformanceWarning();

      expect(shouldWarn).toBe(false);
    });

    it('should NOT warn for mid-range devices', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'tensor-tpu',
        generation: 'Tensor G2',
        deviceModel: 'Pixel 7',
        manufacturer: 'google',
        isRecommendedForLLM: true,
      });

      const shouldWarn = await service.shouldShowPerformanceWarning();

      expect(shouldWarn).toBe(false);
    });

    it('should warn for low-end devices', async () => {
      mockPlatformOS('android');
      mockNPUService.setMockInfo({
        hasNPU: false,
        type: 'none',
        generation: 'none',
        deviceModel: 'Low End Device',
        manufacturer: 'other',
        isRecommendedForLLM: false,
      });

      const shouldWarn = await service.shouldShowPerformanceWarning();
      const warning = await service.getPerformanceWarning();

      expect(shouldWarn).toBe(true);
      expect(warning).not.toBeNull();
      expect(warning).toContain('capacités limitées');
    });
  });

  describe('Device Information', () => {
    it('should provide human-readable device tier description', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A15 Bionic',
        deviceModel: 'iPhone14,2',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const description = await service.getDeviceTierDescription();

      expect(description).toContain('Haut de gamme');
      expect(description).toContain('iPhone14,2');
    });
  });

  describe('Integration with Whisper Performance', () => {
    it('should document GPU acceleration status', async () => {
      mockNPUService.setMockInfo({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A16 Bionic',
        deviceModel: 'iPhone14,2',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      });

      const capabilities = await service.detectCapabilities();

      // GPU acceleration available on devices with NPU
      expect(capabilities.hasAcceleration).toBe(true);
    });

    it('should note CPU fallback for devices without NPU', async () => {
      mockNPUService.setMockInfo({
        hasNPU: false,
        type: 'none',
        generation: 'none',
        deviceModel: 'Generic',
        manufacturer: 'other',
        isRecommendedForLLM: false,
      });

      const capabilities = await service.detectCapabilities();

      // Must use CPU fallback (TranscriptionService handles this)
      expect(capabilities.hasAcceleration).toBe(false);
    });
  });
});
