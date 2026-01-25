/**
 * NPUDetectionService - Detect AI accelerators on mobile devices
 *
 * Supports:
 * - Apple Neural Engine (iPhone X/A11 and later)
 * - Google Tensor TPU (Pixel 6+)
 * - Samsung NPU (Galaxy S10+ with Exynos, or Snapdragon NPU)
 * - Qualcomm Hexagon NPU (many Android flagships)
 *
 * This enables optimized LLM inference using hardware acceleration.
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { Platform, NativeModules } from 'react-native';

export type AcceleratorType = 'neural-engine' | 'tensor-tpu' | 'samsung-npu' | 'snapdragon-npu' | 'none';
export type AcceleratorGeneration = string; // e.g., 'A17 Pro', 'G4', 'Exynos 2400'

export interface NPUInfo {
  /** Whether device has an AI accelerator */
  hasNPU: boolean;
  /** Type of accelerator */
  type: AcceleratorType;
  /** Generation/chip name */
  generation: AcceleratorGeneration;
  /** Device model name */
  deviceModel: string;
  /** Device manufacturer */
  manufacturer: 'apple' | 'google' | 'samsung' | 'other';
  /** Whether NPU is recommended for on-device LLM */
  isRecommendedForLLM: boolean;
}

/**
 * Apple chip mapping - Neural Engine support
 * All A11+ chips have Neural Engine
 */
const APPLE_CHIP_MAP: Record<string, { generation: string; recommendedForLLM: boolean }> = {
  // iPhone models -> chip mapping (based on device identifier patterns)
  'iPhone10': { generation: 'A11 Bionic', recommendedForLLM: false }, // iPhone X, 8
  'iPhone11': { generation: 'A12 Bionic', recommendedForLLM: false }, // iPhone XR, XS
  'iPhone12': { generation: 'A13 Bionic', recommendedForLLM: false }, // iPhone 11
  'iPhone13': { generation: 'A14 Bionic', recommendedForLLM: true },  // iPhone 12
  'iPhone14': { generation: 'A15 Bionic', recommendedForLLM: true },  // iPhone 13, 14
  'iPhone15': { generation: 'A16 Bionic', recommendedForLLM: true },  // iPhone 14 Pro, 15
  'iPhone16': { generation: 'A17 Pro', recommendedForLLM: true },     // iPhone 15 Pro
  'iPhone17': { generation: 'A18', recommendedForLLM: true },         // iPhone 16
};

/**
 * Google Pixel TPU mapping
 */
const PIXEL_TPU_MAP: Record<string, { generation: string; recommendedForLLM: boolean }> = {
  'Pixel 6': { generation: 'Tensor G1', recommendedForLLM: false },
  'Pixel 6 Pro': { generation: 'Tensor G1', recommendedForLLM: false },
  'Pixel 6a': { generation: 'Tensor G1', recommendedForLLM: false },
  'Pixel 7': { generation: 'Tensor G2', recommendedForLLM: true },
  'Pixel 7 Pro': { generation: 'Tensor G2', recommendedForLLM: true },
  'Pixel 7a': { generation: 'Tensor G2', recommendedForLLM: true },
  'Pixel 8': { generation: 'Tensor G3', recommendedForLLM: true },
  'Pixel 8 Pro': { generation: 'Tensor G3', recommendedForLLM: true },
  'Pixel 8a': { generation: 'Tensor G3', recommendedForLLM: true },
  'Pixel 9': { generation: 'Tensor G4', recommendedForLLM: true },
  'Pixel 9 Pro': { generation: 'Tensor G4', recommendedForLLM: true },
  'Pixel 9 Pro XL': { generation: 'Tensor G4', recommendedForLLM: true },
  'Pixel 9 Pro Fold': { generation: 'Tensor G4', recommendedForLLM: true },
  'Pixel 10': { generation: 'Tensor G5', recommendedForLLM: true },
  'Pixel 10 Pro': { generation: 'Tensor G5', recommendedForLLM: true },
  'Pixel 10 Pro XL': { generation: 'Tensor G5', recommendedForLLM: true },
};

/**
 * Samsung Galaxy flagship mapping (Exynos NPU)
 * Note: Some regions use Snapdragon instead
 */
const SAMSUNG_NPU_MAP: Record<string, { generation: string; recommendedForLLM: boolean }> = {
  // Galaxy S series
  'SM-G97': { generation: 'Exynos 9820', recommendedForLLM: false },  // S10
  'SM-G98': { generation: 'Exynos 990', recommendedForLLM: false },   // S20
  'SM-G99': { generation: 'Exynos 2100', recommendedForLLM: true },   // S21
  'SM-S90': { generation: 'Exynos 2200', recommendedForLLM: true },   // S22
  'SM-S91': { generation: 'Exynos 2300', recommendedForLLM: true },   // S23
  'SM-S92': { generation: 'Exynos 2400', recommendedForLLM: true },   // S24
  'SM-S93': { generation: 'Exynos 2500', recommendedForLLM: true },   // S25 (estimated)
  // Galaxy Z Fold/Flip
  'SM-F9': { generation: 'Exynos/Snapdragon', recommendedForLLM: true },
};

@injectable()
export class NPUDetectionService {
  private cachedInfo: NPUInfo | null = null;

  /**
   * Detect NPU/AI accelerator for current device
   */
  async detectNPU(): Promise<NPUInfo> {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    if (Platform.OS === 'ios') {
      this.cachedInfo = this.detectAppleNeuralEngine();
    } else if (Platform.OS === 'android') {
      this.cachedInfo = this.detectAndroidNPU();
    } else {
      this.cachedInfo = this.createNoNPUInfo('Unknown');
    }

    console.log('[NPUDetectionService] Detection result:', this.cachedInfo);
    return this.cachedInfo;
  }

  /**
   * Detect Apple Neural Engine
   */
  private detectAppleNeuralEngine(): NPUInfo {
    // Get device model identifier (e.g., "iPhone14,2")
    const { PlatformConstants } = NativeModules;
    const modelIdentifier = PlatformConstants?.interfaceIdiom === 'phone'
      ? (PlatformConstants?.systemName || 'iPhone')
      : 'iPhone';

    // Try to get more specific model info
    // On iOS, we can use the model identifier pattern
    const deviceModel = Platform.constants?.Model || 'iPhone';

    // Check for Neural Engine support (A11+, iPhone X and later)
    // All modern iPhones (2017+) have Neural Engine
    let generation = 'Neural Engine';
    let recommendedForLLM = true;

    // Try to match iPhone generation
    for (const [pattern, info] of Object.entries(APPLE_CHIP_MAP)) {
      if (deviceModel.includes(pattern)) {
        generation = info.generation;
        recommendedForLLM = info.recommendedForLLM;
        break;
      }
    }

    // iPhone X (2017) and later all have Neural Engine
    // For simplicity, assume all iOS devices running modern iOS have it
    return {
      hasNPU: true,
      type: 'neural-engine',
      generation,
      deviceModel,
      manufacturer: 'apple',
      isRecommendedForLLM: recommendedForLLM,
    };
  }

  /**
   * Detect Android NPU (Google TPU, Samsung NPU, Snapdragon NPU)
   */
  private detectAndroidNPU(): NPUInfo {
    // Try multiple sources for device info
    const { PlatformConstants } = NativeModules;
    const platformConsts = Platform.constants as Record<string, unknown>;

    // Get model name from various sources
    const modelName = (
      PlatformConstants?.Model ||
      platformConsts?.Model ||
      platformConsts?.model ||
      ''
    ) as string;

    // Get manufacturer from various sources
    const manufacturer = (
      PlatformConstants?.Manufacturer ||
      platformConsts?.Manufacturer ||
      platformConsts?.manufacturer ||
      ''
    ).toString().toLowerCase();

    // Get brand from various sources
    const brand = (
      PlatformConstants?.Brand ||
      platformConsts?.Brand ||
      platformConsts?.brand ||
      ''
    ).toString().toLowerCase();

    console.log('[NPUDetectionService] Android device info:', {
      modelName,
      manufacturer,
      brand,
      platformConsts: JSON.stringify(platformConsts),
    });

    // Check Google Pixel (Tensor TPU)
    if (manufacturer === 'google' || brand === 'google') {
      return this.detectGoogleTensor(modelName);
    }

    // Check Samsung (Exynos NPU or Snapdragon)
    if (manufacturer === 'samsung' || brand === 'samsung') {
      return this.detectSamsungNPU(modelName);
    }

    // Check for Snapdragon NPU on other devices
    // Most modern Android flagships have some form of NPU
    return this.detectSnapdragonNPU(modelName, manufacturer);
  }

  /**
   * Detect Google Tensor TPU
   */
  private detectGoogleTensor(modelName: string): NPUInfo {
    // Check exact model match
    for (const [pixelModel, info] of Object.entries(PIXEL_TPU_MAP)) {
      if (modelName.includes(pixelModel)) {
        return {
          hasNPU: true,
          type: 'tensor-tpu',
          generation: info.generation,
          deviceModel: modelName,
          manufacturer: 'google',
          isRecommendedForLLM: info.recommendedForLLM,
        };
      }
    }

    // Fallback: check for generic Pixel pattern
    const pixelMatch = modelName.match(/Pixel\s*(\d+)/i);
    if (pixelMatch) {
      const version = parseInt(pixelMatch[1], 10);
      if (version >= 6) {
        const genMap: Record<number, string> = {
          6: 'Tensor G1', 7: 'Tensor G2', 8: 'Tensor G3',
          9: 'Tensor G4', 10: 'Tensor G5',
        };
        return {
          hasNPU: true,
          type: 'tensor-tpu',
          generation: genMap[version] || `Tensor G${version - 5}`,
          deviceModel: modelName,
          manufacturer: 'google',
          isRecommendedForLLM: version >= 7,
        };
      }
    }

    return this.createNoNPUInfo(modelName, 'google');
  }

  /**
   * Detect Samsung NPU (Exynos or Snapdragon)
   */
  private detectSamsungNPU(modelName: string): NPUInfo {
    // Check model number pattern (e.g., SM-S918B)
    for (const [pattern, info] of Object.entries(SAMSUNG_NPU_MAP)) {
      if (modelName.startsWith(pattern)) {
        return {
          hasNPU: true,
          type: 'samsung-npu',
          generation: info.generation,
          deviceModel: modelName,
          manufacturer: 'samsung',
          isRecommendedForLLM: info.recommendedForLLM,
        };
      }
    }

    // Check for Galaxy S/Z series patterns
    const galaxyMatch = modelName.match(/Galaxy\s*(S|Z)\s*(\d+)/i);
    if (galaxyMatch) {
      const series = galaxyMatch[1].toUpperCase();
      const version = parseInt(galaxyMatch[2], 10);

      // Galaxy S10+ (2019) and later have NPU
      if ((series === 'S' && version >= 10) || series === 'Z') {
        return {
          hasNPU: true,
          type: 'samsung-npu',
          generation: `Galaxy ${series}${version} NPU`,
          deviceModel: modelName,
          manufacturer: 'samsung',
          isRecommendedForLLM: version >= 21 || series === 'Z',
        };
      }
    }

    return this.createNoNPUInfo(modelName, 'samsung');
  }

  /**
   * Detect Snapdragon NPU on other Android devices
   */
  private detectSnapdragonNPU(modelName: string, manufacturer: string): NPUInfo {
    // Most modern Android flagships (2020+) have Snapdragon with NPU
    // We can't easily detect the exact chip, so we assume recent devices have it

    // Check for known flagship manufacturers
    const flagshipManufacturers = ['oneplus', 'xiaomi', 'oppo', 'vivo', 'nothing', 'asus', 'sony'];

    if (flagshipManufacturers.includes(manufacturer)) {
      return {
        hasNPU: true,
        type: 'snapdragon-npu',
        generation: 'Snapdragon NPU',
        deviceModel: modelName,
        manufacturer: 'other',
        isRecommendedForLLM: true, // Assume modern flagships are capable
      };
    }

    // For unknown devices, assume no NPU (safer fallback)
    return this.createNoNPUInfo(modelName, 'other');
  }

  /**
   * Create a "no NPU" info object
   */
  private createNoNPUInfo(deviceModel: string, manufacturer: 'apple' | 'google' | 'samsung' | 'other' = 'other'): NPUInfo {
    return {
      hasNPU: false,
      type: 'none',
      generation: 'none',
      deviceModel,
      manufacturer,
      isRecommendedForLLM: false,
    };
  }

  /**
   * Quick check if device has NPU
   */
  async hasNPU(): Promise<boolean> {
    const info = await this.detectNPU();
    return info.hasNPU;
  }

  /**
   * Check if NPU is recommended for LLM inference
   */
  async isRecommendedForLLM(): Promise<boolean> {
    const info = await this.detectNPU();
    return info.isRecommendedForLLM;
  }

  /**
   * Get human-readable NPU description
   */
  async getNPUDescription(): Promise<string> {
    const info = await this.detectNPU();

    if (!info.hasNPU) {
      return 'Aucun accélérateur IA détecté';
    }

    const typeLabels: Record<AcceleratorType, string> = {
      'neural-engine': 'Apple Neural Engine',
      'tensor-tpu': 'Google Tensor TPU',
      'samsung-npu': 'Samsung NPU',
      'snapdragon-npu': 'Qualcomm NPU',
      'none': '',
    };

    return `${typeLabels[info.type]} ${info.generation} (${info.deviceModel})`;
  }

  /**
   * Get the preferred backend type for this device
   */
  async getPreferredBackend(): Promise<'coreml' | 'mediapipe' | 'llamarn'> {
    const info = await this.detectNPU();

    if (info.type === 'neural-engine') {
      return 'coreml'; // Use CoreML on Apple devices
    }

    if (info.type === 'tensor-tpu') {
      return 'mediapipe'; // Use MediaPipe on Pixel devices
    }

    // For Samsung and others, use llama.rn (GPU acceleration)
    return 'llamarn';
  }

  /**
   * Clear cached detection result
   */
  clearCache(): void {
    this.cachedInfo = null;
  }
}

// Re-export old name for backward compatibility
export { NPUDetectionService as TPUDetectionService };
