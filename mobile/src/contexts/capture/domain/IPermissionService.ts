/**
 * Permission Service Interface
 *
 * Defines contract for microphone permission management.
 * Enables dependency injection and testing.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

export interface PermissionResult {
  status: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
  expires?: "never" | number;
}

export interface IPermissionService {
  /**
   * Request microphone permission from user
   * Prompts the user if permission not yet determined
   */
  requestMicrophonePermission(): Promise<PermissionResult>;

  /**
   * Check current microphone permission status
   * Does NOT prompt the user
   */
  checkMicrophonePermission(): Promise<PermissionResult>;

  /**
   * Helper: Check if microphone permission is granted
   */
  hasMicrophonePermission(): Promise<boolean>;

  /**
   * Open device settings to allow user to manually grant permission
   */
  openSettings(): Promise<void>;
}
