/**
 * Encryption Service Interface
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC6: Encryption at Rest
 * NFR12: All data encrypted at rest
 */

export interface EncryptionStatus {
  /** Is encryption available on this device? */
  available: boolean;
  /** Encryption type (OS-level) */
  type: "ios-data-protection" | "android-fbe" | "none";
  /** Human-readable status message */
  message: string;
  /** Verification method used */
  verificationMethod: string;
}

export interface IEncryptionService {
  /**
   * Check if device-level encryption is available
   *
   * Returns encryption status with OS-specific details:
   * - iOS: Data Protection API status
   * - Android: File-based Encryption (FBE) status
   */
  checkEncryptionStatus(): Promise<EncryptionStatus>;
}
