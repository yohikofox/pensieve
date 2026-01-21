import {
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import { Linking } from 'react-native';

/**
 * Permission Service for Audio Recording
 *
 * Uses expo-audio (Expo SDK 54+)
 * expo-av is deprecated and removed in SDK 55
 *
 * Handles microphone permission requests and status checks
 * AC5: Microphone Permission Handling
 *
 * Docs: https://docs.expo.dev/versions/latest/sdk/audio/
 */

export interface PermissionResult {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  expires?: 'never' | number;
}

export class PermissionService {
  /**
   * Request microphone permission from user
   * Prompts the user if permission not yet determined
   *
   * Uses expo-audio's requestRecordingPermissionsAsync()
   *
   * @returns Permission result with status and canAskAgain flag
   */
  static async requestMicrophonePermission(): Promise<PermissionResult> {
    try {
      const permission = await requestRecordingPermissionsAsync();

      return {
        status: permission.granted ? 'granted' : 'denied',
        canAskAgain: permission.canAskAgain,
        expires: permission.expires,
      };
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return {
        status: 'denied',
        canAskAgain: false,
      };
    }
  }

  /**
   * Check current microphone permission status
   * Does NOT prompt the user
   *
   * Uses expo-audio's getRecordingPermissionsAsync()
   *
   * @returns Current permission status
   */
  static async checkMicrophonePermission(): Promise<PermissionResult> {
    try {
      const permission = await getRecordingPermissionsAsync();

      return {
        status: permission.granted ? 'granted' : 'undetermined',
        canAskAgain: permission.canAskAgain,
        expires: permission.expires,
      };
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return {
        status: 'undetermined',
        canAskAgain: true,
      };
    }
  }

  /**
   * Helper: Check if microphone permission is granted
   *
   * @returns true if permission granted, false otherwise
   */
  static async hasMicrophonePermission(): Promise<boolean> {
    const permission = await PermissionService.checkMicrophonePermission();
    return permission.status === 'granted';
  }

  /**
   * Open device settings to allow user to manually grant permission
   * Useful when canAskAgain is false
   */
  static async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }
}
