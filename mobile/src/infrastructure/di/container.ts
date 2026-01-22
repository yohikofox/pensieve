/**
 * TSyringe IoC Container Configuration
 *
 * Registers all production services and repositories.
 * Import this file in App.tsx to initialize the container.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-IoC - TSyringe for Dependency Injection
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';

// Repositories
import { CaptureRepository } from '../../contexts/capture/data/CaptureRepository';

// Services
import { PermissionService } from '../../contexts/capture/services/PermissionService';
import { FileStorageService } from '../../contexts/capture/services/FileStorageService';
import { OfflineSyncService } from '../../contexts/capture/services/OfflineSyncService';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';

// Platform Adapters
import { ExpoAudioAdapter } from '../adapters/ExpoAudioAdapter';
import { ExpoFileSystemAdapter } from '../adapters/ExpoFileSystemAdapter';

/**
 * Register all production services and repositories
 *
 * Call this function once at app startup (in App.tsx)
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */
export function registerServices() {
  // Domain Repositories
  container.registerSingleton(TOKENS.ICaptureRepository, CaptureRepository);

  // Platform Adapters (Hardware/SDK wrappers)
  container.registerSingleton(TOKENS.IAudioRecorder, ExpoAudioAdapter);
  container.registerSingleton(TOKENS.IFileSystem, ExpoFileSystemAdapter);

  // Application Services
  container.registerSingleton(TOKENS.IPermissionService, PermissionService);
  container.registerSingleton(TOKENS.IFileStorageService, FileStorageService);
  container.registerSingleton(TOKENS.IOfflineSyncService, OfflineSyncService);
  container.registerSingleton(TOKENS.ICrashRecoveryService, CrashRecoveryService);
}
