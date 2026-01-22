import 'reflect-metadata';
import { injectable } from 'tsyringe';
import {
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import { Linking } from 'react-native';
import {
  type IPermissionService,
  type PermissionResult,
} from '../domain/IPermissionService';

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
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

@injectable()
export class PermissionService implements IPermissionService {
  /**
   * Request microphone permission from user
   * Prompts the user if permission not yet determined
   *
   * Uses expo-audio's requestRecordingPermissionsAsync()
   *
   * @returns Permission result with status and canAskAgain flag
   */
  async requestMicrophonePermission(): Promise<PermissionResult> {
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
  async checkMicrophonePermission(): Promise<PermissionResult> {
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
  async hasMicrophonePermission(): Promise<boolean> {
    const permission = await this.checkMicrophonePermission();
    return permission.status === 'granted';
  }

  /**
   * Open device settings to allow user to manually grant permission
   * Useful when canAskAgain is false
   */
  async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }
}
