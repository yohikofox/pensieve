/**
 * DeviceCapabilitiesService - Detect device capabilities for Whisper optimization
 *
 * Story 2.5 - Task 7.3: Device-specific optimizations
 *
 * Responsibilities:
 * - Detect device tier (high-end, mid-range, low-end)
 * - Recommend Whisper model size based on capabilities
 * - Warn users on low-end devices about performance
 * - Use NPUDetectionService for AI accelerator info
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { Platform } from 'react-native';
import type { WhisperModelSize } from './WhisperModelService';
import { NPUDetectionService } from './NPUDetectionService';

export type DeviceTier = 'high-end' | 'mid-range' | 'low-end';

export interface DeviceCapabilities {
  /** Device tier based on CPU/NPU/RAM */
  tier: DeviceTier;
  /** Recommended Whisper model size */
  recommendedWhisperModel: WhisperModelSize;
  /** Whether device has GPU/NPU acceleration */
  hasAcceleration: boolean;
  /** Human-readable device info */
  deviceInfo: string;
  /** Whether to show performance warning */
  shouldWarnPerformance: boolean;
  /** Performance warning message (if applicable) */
  performanceWarning?: string;
}

/**
 * iOS device tiers based on chip generation
 */
const IOS_DEVICE_TIERS: Record<string, DeviceTier> = {
  // A17/A18 (iPhone 15 Pro, 16)
  'A17': 'high-end',
  'A18': 'high-end',
  // A15/A16 (iPhone 13-15)
  'A15': 'high-end',
  'A16': 'high-end',
  // A14 (iPhone 12)
  'A14': 'mid-range',
  // A13 (iPhone 11)
  'A13': 'mid-range',
  // A12 and older
  'A12': 'low-end',
  'A11': 'low-end',
};

/**
 * Android device tiers based on manufacturer/chip
 */
const ANDROID_TIER_PATTERNS = {
  'high-end': ['Pixel 8', 'Pixel 9', 'Pixel 10', 'Galaxy S2', 'Galaxy Z', 'Exynos 24', 'Tensor G3', 'Tensor G4', 'Tensor G5'],
  'mid-range': ['Pixel 6', 'Pixel 7', 'Galaxy S1', 'Galaxy A', 'Exynos 21', 'Exynos 22', 'Tensor G1', 'Tensor G2'],
  'low-end': [],
};

@injectable()
export class DeviceCapabilitiesService {
  constructor(
    @inject(NPUDetectionService) private npuService: NPUDetectionService
  ) {}

  /**
   * Detect device capabilities and recommend Whisper model
   */
  async detectCapabilities(): Promise<DeviceCapabilities> {
    const tier = await this.detectDeviceTier();
    const npuInfo = await this.npuService.detectNPU();

    // Determine recommended Whisper model
    let recommendedWhisperModel: WhisperModelSize;
    let shouldWarnPerformance = false;
    let performanceWarning: string | undefined;

    switch (tier) {
      case 'high-end':
        // High-end devices can handle base model comfortably
        recommendedWhisperModel = 'base';
        break;

      case 'mid-range':
        // Mid-range devices should use tiny for better performance
        recommendedWhisperModel = 'tiny';
        break;

      case 'low-end':
        // Low-end devices: tiny model with performance warning
        recommendedWhisperModel = 'tiny';
        shouldWarnPerformance = true;
        performanceWarning =
          'Votre appareil a des capacités limitées. La transcription peut prendre plus de temps que prévu. ' +
          'Pour de meilleures performances, utilisez un appareil plus récent.';
        break;
    }

    const deviceInfo = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} - ${npuInfo.deviceModel}`;

    return {
      tier,
      recommendedWhisperModel,
      hasAcceleration: npuInfo.hasNPU,
      deviceInfo,
      shouldWarnPerformance,
      performanceWarning,
    };
  }

  /**
   * Detect device tier based on platform and NPU info
   */
  private async detectDeviceTier(): Promise<DeviceTier> {
    if (Platform.OS === 'ios') {
      return await this.detectIOSTier();
    } else {
      return await this.detectAndroidTier();
    }
  }

  /**
   * Detect iOS device tier based on chip generation
   */
  private async detectIOSTier(): Promise<DeviceTier> {
    const npuInfo = await this.npuService.detectNPU();
    const generation = npuInfo.generation || '';

    // Check for chip generation in NPU info
    for (const [chip, tier] of Object.entries(IOS_DEVICE_TIERS)) {
      if (generation.includes(chip)) {
        console.log(`[DeviceCapabilitiesService] iOS tier: ${tier} (${generation})`);
        return tier;
      }
    }

    // Default to mid-range for modern iOS devices
    console.log(`[DeviceCapabilitiesService] iOS tier: mid-range (default)`);
    return 'mid-range';
  }

  /**
   * Detect Android device tier based on model and manufacturer
   */
  private async detectAndroidTier(): Promise<DeviceTier> {
    const npuInfo = await this.npuService.detectNPU();
    const deviceModel = npuInfo.deviceModel;
    const generation = npuInfo.generation;

    // Check high-end patterns
    for (const pattern of ANDROID_TIER_PATTERNS['high-end']) {
      if (deviceModel.includes(pattern) || generation.includes(pattern)) {
        console.log(`[DeviceCapabilitiesService] Android tier: high-end (${deviceModel})`);
        return 'high-end';
      }
    }

    // Check mid-range patterns
    for (const pattern of ANDROID_TIER_PATTERNS['mid-range']) {
      if (deviceModel.includes(pattern) || generation.includes(pattern)) {
        console.log(`[DeviceCapabilitiesService] Android tier: mid-range (${deviceModel})`);
        return 'mid-range';
      }
    }

    // Check if device has NPU - likely mid-range or better
    if (npuInfo.hasNPU) {
      console.log(`[DeviceCapabilitiesService] Android tier: mid-range (has NPU)`);
      return 'mid-range';
    }

    // Default to low-end for unknown devices without NPU
    console.log(`[DeviceCapabilitiesService] Android tier: low-end (default)`);
    return 'low-end';
  }

  /**
   * Get human-readable device tier description
   */
  async getDeviceTierDescription(): Promise<string> {
    const capabilities = await this.detectCapabilities();

    const tierLabels: Record<DeviceTier, string> = {
      'high-end': 'Haut de gamme',
      'mid-range': 'Milieu de gamme',
      'low-end': 'Entrée de gamme',
    };

    return `${tierLabels[capabilities.tier]} - ${capabilities.deviceInfo}`;
  }

  /**
   * Check if device should show performance warning
   */
  async shouldShowPerformanceWarning(): Promise<boolean> {
    const capabilities = await this.detectCapabilities();
    return capabilities.shouldWarnPerformance;
  }

  /**
   * Get performance warning message (if applicable)
   */
  async getPerformanceWarning(): Promise<string | null> {
    const capabilities = await this.detectCapabilities();
    return capabilities.performanceWarning || null;
  }
}
