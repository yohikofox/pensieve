/**
 * Audio Recorder Interface
 *
 * Abstraction for audio recording hardware/SDK.
 * Production implementation uses expo-audio.
 * Test implementation uses in-memory mocks.
 *
 * Uses Result<> pattern - no exceptions thrown
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import { type RepositoryResult } from './Result';

export interface IAudioRecorder {
  /**
   * Start audio recording
   * @returns Result with temporary file URI
   */
  startRecording(): Promise<RepositoryResult<{ uri: string }>>;

  /**
   * Stop audio recording
   * @returns Result with final file URI and duration in milliseconds
   */
  stopRecording(): Promise<RepositoryResult<{ uri: string; duration: number }>>;

  /**
   * Get current recording status
   * Optional method for status monitoring
   */
  getStatus?(): { isRecording: boolean; durationMillis: number; uri?: string };
}
