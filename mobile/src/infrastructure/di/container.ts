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
import { CaptureMetadataRepository } from '../../contexts/capture/data/CaptureMetadataRepository';
import { CaptureAnalysisRepository } from '../../contexts/capture/data/CaptureAnalysisRepository';

// Services
import { RecordingService } from '../../contexts/capture/services/RecordingService';
import { PermissionService } from '../../contexts/capture/services/PermissionService';
import { FileStorageService } from '../../contexts/capture/services/FileStorageService';
import { OfflineSyncService } from '../../contexts/capture/services/OfflineSyncService';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';
import { SyncQueueService } from '../../contexts/capture/services/SyncQueueService';
import { StorageMonitorService } from '../../contexts/capture/services/StorageMonitorService';
import { RetentionPolicyService } from '../../contexts/capture/services/RetentionPolicyService';
import { EncryptionService } from '../../contexts/capture/services/EncryptionService';

// Normalization Services (Story 2.5)
import { AudioConversionService } from '../../contexts/Normalization/services/AudioConversionService';
import { TranscriptionService } from '../../contexts/Normalization/services/TranscriptionService';
import { TranscriptionQueueService } from '../../contexts/Normalization/services/TranscriptionQueueService';
import { TranscriptionQueueProcessor } from '../../contexts/Normalization/processors/TranscriptionQueueProcessor';
import { TranscriptionWorker } from '../../contexts/Normalization/workers/TranscriptionWorker';
import { WhisperModelService } from '../../contexts/Normalization/services/WhisperModelService';

// Post-processing Services (LLM enhancement)
import { NPUDetectionService } from '../../contexts/Normalization/services/NPUDetectionService';
import { LLMModelService } from '../../contexts/Normalization/services/LLMModelService';
import { PostProcessingService } from '../../contexts/Normalization/services/PostProcessingService';
import { HuggingFaceAuthService } from '../../contexts/Normalization/services/HuggingFaceAuthService';
import { CaptureAnalysisService } from '../../contexts/Normalization/services/CaptureAnalysisService';

// Native Speech Recognition
import { NativeTranscriptionEngine } from '../../contexts/Normalization/services/NativeTranscriptionEngine';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';

// Platform Adapters
import { ExpoAudioAdapter } from '../adapters/ExpoAudioAdapter';
import { ExpoFileSystemAdapter } from '../adapters/ExpoFileSystemAdapter';

// Event Infrastructure (ADR-019)
import { eventBus } from '../../contexts/shared/events/EventBus';

// Guard against multiple registrations (Fast Refresh can re-evaluate module)
let servicesRegistered = false;

/**
 * Register all production services and repositories
 *
 * Call this function once at app startup (in App.tsx)
 * Idempotent: Multiple calls have no effect.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */
export function registerServices() {
  if (servicesRegistered) {
    console.log('[DI Container] Services already registered, skipping');
    return;
  }

  // Event Infrastructure (ADR-019)
  // Register EventBus singleton instance (shared message bus)
  container.registerInstance('EventBus', eventBus);

  // Domain Repositories
  container.registerSingleton(TOKENS.ICaptureRepository, CaptureRepository);
  container.registerSingleton(TOKENS.ICaptureMetadataRepository, CaptureMetadataRepository);
  container.registerSingleton(TOKENS.ICaptureAnalysisRepository, CaptureAnalysisRepository);

  // Platform Adapters (Hardware/SDK wrappers)
  container.registerSingleton(TOKENS.IAudioRecorder, ExpoAudioAdapter);
  container.registerSingleton(TOKENS.IFileSystem, ExpoFileSystemAdapter);

  // Application Services
  container.registerSingleton(RecordingService); // Direct class registration
  container.registerSingleton(FileStorageService); // Direct class registration
  container.registerSingleton(TOKENS.IPermissionService, PermissionService);
  container.registerSingleton(TOKENS.IFileStorageService, FileStorageService);
  container.registerSingleton(TOKENS.IOfflineSyncService, OfflineSyncService);
  container.registerSingleton(TOKENS.ICrashRecoveryService, CrashRecoveryService);
  container.registerSingleton(TOKENS.ISyncQueueService, SyncQueueService);
  container.registerSingleton(TOKENS.IStorageMonitorService, StorageMonitorService);
  container.registerSingleton(TOKENS.IRetentionPolicyService, RetentionPolicyService);
  container.registerSingleton(TOKENS.IEncryptionService, EncryptionService);

  // Normalization Services (Story 2.5 - Transcription)
  container.registerSingleton(AudioConversionService);
  container.registerSingleton(WhisperModelService);
  container.registerSingleton(TranscriptionService);
  container.registerSingleton(TranscriptionQueueService);
  container.registerSingleton(TranscriptionQueueProcessor);

  // Post-processing Services (LLM enhancement)
  container.registerSingleton(HuggingFaceAuthService);
  container.registerSingleton(NPUDetectionService);
  container.registerSingleton(LLMModelService);
  container.registerSingleton(PostProcessingService);
  container.registerSingleton(CaptureAnalysisService);
  container.registerSingleton(TranscriptionWorker);

  // Native Speech Recognition Engine
  container.registerSingleton(NativeTranscriptionEngine);
  container.registerSingleton(TranscriptionEngineService);

  servicesRegistered = true;
  console.log('[DI Container] ✅ Services registered');
}
