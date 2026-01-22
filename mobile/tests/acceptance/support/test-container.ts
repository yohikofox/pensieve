/**
 * Test Container - TSyringe Configuration for Acceptance Tests
 *
 * Registers mock implementations for BDD tests.
 * Replaces production services with in-memory mocks.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from '../../../src/infrastructure/di/tokens';
import { MockCaptureRepository } from './mocks/MockCaptureRepository';
import { MockAudioRecorder } from './test-context';
import { MockFileSystem } from './test-context';
import { MockPermissionManager } from './test-context';

/**
 * Setup test container with mock implementations
 *
 * Call this in beforeEach() to ensure clean test isolation
 */
export function setupTestContainer() {
  container.reset();
  container.registerSingleton(TOKENS.ICaptureRepository, MockCaptureRepository);
  container.registerSingleton(TOKENS.IAudioRecorder, MockAudioRecorder);
  container.registerSingleton(TOKENS.IFileSystem, MockFileSystem);
  container.registerSingleton(TOKENS.IPermissionService, MockPermissionManager);
}

/**
 * Get mock instances from container for test assertions
 */
export function getTestMocks() {
  return {
    captureRepo: container.resolve<MockCaptureRepository>(TOKENS.ICaptureRepository as any),
    audioRecorder: container.resolve<MockAudioRecorder>(TOKENS.IAudioRecorder as any),
    fileSystem: container.resolve<MockFileSystem>(TOKENS.IFileSystem as any),
    permissions: container.resolve<MockPermissionManager>(TOKENS.IPermissionService as any),
  };
}
