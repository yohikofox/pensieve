/**
 * TSyringe IoC Container Configuration
 *
 * Registers all production services and repositories.
 * Import this file in App.tsx to initialize the container.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 *
 * Lifecycle Strategy: ADR-021 — Transient First
 * - Repositories and stateless services → Transient (container.register)
 * - Singletons only when explicitly justified (see inline comments)
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';

/**
 * Re-export container for use in components/hooks
 *
 * Story 6.2 - Bug Fix: Container must be exported for lazy resolution
 *
 * Why export?
 * - React hooks/components need to resolve services at runtime (not module load time)
 * - Direct import from 'tsyringe' would create multiple container instances
 * - Centralized export ensures single container instance across the app
 *
 * Example usage in hooks:
 * ```typescript
 * import { container } from '../../infrastructure/di/container';
 * const authService = container.resolve<IAuthService>('IAuthService');
 * ```
 */
export { container };

// Infrastructure Services
import { LoggerService } from '../logging/LoggerService';
import type { ILogger } from '../logging/ILogger';

// Repositories
import { CaptureRepository } from '../../contexts/capture/data/CaptureRepository';
import { CaptureMetadataRepository } from '../../contexts/capture/data/CaptureMetadataRepository';
import { CaptureAnalysisRepository } from '../../contexts/capture/data/CaptureAnalysisRepository';
import { ThoughtRepository } from '../../contexts/knowledge/data/ThoughtRepository';
import { IdeaRepository } from '../../contexts/knowledge/data/IdeaRepository';
import { TodoRepository } from '../../contexts/action/data/TodoRepository';
import { AnalysisTodoRepository } from '../../contexts/action/data/AnalysisTodoRepository';
import { UserFeaturesRepository } from '../../contexts/identity/data/user-features.repository';

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
import { WaveformExtractionService } from '../../contexts/capture/services/WaveformExtractionService';

// Normalization Services (Story 2.5)
import { ExpoFileSystem } from '../../contexts/Normalization/adapters/ExpoFileSystem';
import { AudioConversionService } from '../../contexts/Normalization/services/AudioConversionService';
import { TranscriptionService } from '../../contexts/Normalization/services/TranscriptionService';
import { TranscriptionQueueService } from '../../contexts/Normalization/services/TranscriptionQueueService';
import { TranscriptionQueueProcessor } from '../../contexts/Normalization/processors/TranscriptionQueueProcessor';
import { TranscriptionWorker } from '../../contexts/Normalization/workers/TranscriptionWorker';
import { TranscriptionModelService } from '../../contexts/Normalization/services/TranscriptionModelService';

// Post-processing Services (LLM enhancement)
import { NPUDetectionService } from '../../contexts/Normalization/services/NPUDetectionService';
import { DeviceCapabilitiesService } from '../../contexts/Normalization/services/DeviceCapabilitiesService';
import { LLMModelService } from '../../contexts/Normalization/services/LLMModelService';
import { PostProcessingService } from '../../contexts/Normalization/services/PostProcessingService';
import { HuggingFaceAuthService } from '../../contexts/Normalization/services/HuggingFaceAuthService';
import { CaptureAnalysisService } from '../../contexts/Normalization/services/CaptureAnalysisService';
import type { IHuggingFaceAuthService } from '../../contexts/Normalization/domain/IHuggingFaceAuthService';
import type { ILLMModelService } from '../../contexts/Normalization/domain/ILLMModelService';

// Native Speech Recognition
import { NativeTranscriptionEngine } from '../../contexts/Normalization/services/NativeTranscriptionEngine';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';

// Identity Services (Story 7.1)
import { UserFeaturesService } from '../../contexts/identity/services/user-features.service';
import { SupabaseAuthService } from '../../contexts/identity/services/SupabaseAuthService';
import type { IAuthService } from '../../contexts/identity/domain/IAuthService';

// Sync Infrastructure (Story 6.1 & 6.2)
import { SyncService } from '../sync/SyncService';
import { SyncTrigger } from '../sync/SyncTrigger';
import { NetworkMonitor } from '../network/NetworkMonitor';
import { AutoSyncOrchestrator } from '../sync/AutoSyncOrchestrator';

// Upload Infrastructure (Story 6.2)
import { AudioUploadService } from '../upload/AudioUploadService';
import { ChunkedUploadService } from '../upload/ChunkedUploadService';
import { UploadOrchestrator } from '../upload/UploadOrchestrator';

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
 * Lifecycle Strategy: ADR-021 — Transient First
 */
export function registerServices() {
  if (servicesRegistered) {
    console.log('[DI Container] Services already registered, skipping');
    return;
  }

  // ── SINGLETONS ─────────────────────────────────────────────────────────────
  // Justification requise pour chaque singleton (ADR-021)

  // SINGLETON: Logger global — configuration et état partagés sur toute la session (ADR-021)
  container.registerSingleton<ILogger>(TOKENS.ILogger, LoggerService);

  // Event Infrastructure (ADR-019)
  // SINGLETON: EventBus instance — bus de messages partagé entre tous les contextes (ADR-021)
  container.registerInstance('EventBus', eventBus);

  // SINGLETON: Hardware adapter AudioRecorder — exception ADR-021 (coût initialisation natif)
  container.registerSingleton(TOKENS.IAudioRecorder, ExpoAudioAdapter);

  // SINGLETON: Hardware adapter FileSystem — exception ADR-021 (coût initialisation natif)
  container.registerSingleton(TOKENS.IFileSystem, ExpoFileSystemAdapter);

  // SINGLETON: RecordingService — maintient l'état de l'enregistrement actif en cours de session (ADR-021 exception)
  container.registerSingleton(RecordingService);

  // SINGLETON: SyncQueueService — queue de synchronisation en mémoire, état partagé entre résolutions (ADR-021)
  container.registerSingleton(TOKENS.ISyncQueueService, SyncQueueService);

  // SINGLETON: StorageMonitorService — écouteurs d'événements de stockage actifs, état partagé (ADR-021)
  container.registerSingleton(TOKENS.IStorageMonitorService, StorageMonitorService);

  // SINGLETON: TranscriptionModelService — modèle Whisper chargé en mémoire, coût d'initialisation élevé (ADR-021)
  container.registerSingleton(TranscriptionModelService);

  // SINGLETON: TranscriptionService — dépend de TranscriptionModelService singleton (ADR-021)
  container.registerSingleton(TranscriptionService);

  // SINGLETON: TranscriptionQueueService — queue de transcription en mémoire, état partagé (ADR-021)
  container.registerSingleton(TranscriptionQueueService);

  // SINGLETON: TranscriptionQueueProcessor — processeur lié à la queue singleton (ADR-021)
  container.registerSingleton(TranscriptionQueueProcessor);

  // SINGLETON: HuggingFaceAuthService — token d'authentification partagé pour la session (ADR-021)
  container.registerSingleton<IHuggingFaceAuthService>(TOKENS.IHuggingFaceAuthService, HuggingFaceAuthService);

  // SINGLETON: NPUDetectionService — cache la détection hardware NPU (une seule détection nécessaire) (ADR-021)
  container.registerSingleton(NPUDetectionService);

  // SINGLETON: DeviceCapabilitiesService — cache les capacités du device (ADR-021)
  container.registerSingleton(DeviceCapabilitiesService);

  // SINGLETON: LLMModelService — modèle LLM chargé en mémoire, coût d'initialisation très élevé (ADR-021)
  container.registerSingleton<ILLMModelService>(TOKENS.ILLMModelService, LLMModelService);

  // SINGLETON: PostProcessingService — dépend de LLMModelService singleton (ADR-021)
  container.registerSingleton(PostProcessingService);

  // SINGLETON: TranscriptionWorker — worker Whisper, coût d'initialisation élevé (ADR-021)
  container.registerSingleton(TranscriptionWorker);

  // SINGLETON: NativeTranscriptionEngine — moteur de transcription natif, coût d'initialisation élevé (ADR-021)
  container.registerSingleton(NativeTranscriptionEngine);

  // SINGLETON: TranscriptionEngineService — orchestre les engines, maintient l'état de sélection (ADR-021)
  container.registerSingleton(TranscriptionEngineService);

  // SINGLETON: SupabaseAuthService — session d'authentification partagée sur toute la session (ADR-021)
  container.registerSingleton<IAuthService>('IAuthService', SupabaseAuthService);

  // Sync Infrastructure (Story 6.1 & 6.2)
  // SINGLETON: SyncService — auth token est défini sur cette instance et doit être partagé (ADR-021)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  const syncServiceInstance = new SyncService(apiUrl, eventBus);
  container.registerInstance(SyncService, syncServiceInstance);

  // SINGLETON: SyncTrigger — maintient l'état cooldown/debounce de la synchronisation (ADR-021)
  container.registerSingleton(SyncTrigger);

  // SINGLETON: NetworkMonitor — écouteur d'événements réseau natif, doit rester unique (ADR-021)
  container.registerSingleton(NetworkMonitor);

  // SINGLETON: AutoSyncOrchestrator — orchestrateur avec état, dépend de singletons sync (ADR-021)
  container.registerSingleton(AutoSyncOrchestrator);

  // SINGLETON: UploadOrchestrator — dépend de services avec état (ADR-021)
  container.registerSingleton(UploadOrchestrator);

  // ── TRANSIENT ──────────────────────────────────────────────────────────────
  // Services et repositories stateless — nouvelle instance à chaque résolution (ADR-021)

  // Domain Repositories — stateless, accès DB sans état mutable (ADR-021 Transient First)
  container.register(TOKENS.ICaptureRepository, { useClass: CaptureRepository });
  container.register(TOKENS.ICaptureMetadataRepository, { useClass: CaptureMetadataRepository });
  container.register(TOKENS.ICaptureAnalysisRepository, { useClass: CaptureAnalysisRepository });
  container.register(TOKENS.IThoughtRepository, { useClass: ThoughtRepository });
  container.register(TOKENS.IIdeaRepository, { useClass: IdeaRepository });
  container.register(TOKENS.ITodoRepository, { useClass: TodoRepository });
  container.register(TOKENS.IAnalysisTodoRepository, { useClass: AnalysisTodoRepository });
  container.register(TOKENS.IUserFeaturesRepository, { useClass: UserFeaturesRepository });

  // Application Services — stateless, sans dépendances sur état partagé (ADR-021 Transient First)
  container.register(TOKENS.IPermissionService, { useClass: PermissionService });
  container.register(FileStorageService, { useClass: FileStorageService });
  container.register(TOKENS.IFileStorageService, { useClass: FileStorageService });
  container.register(WaveformExtractionService, { useClass: WaveformExtractionService });
  container.register(TOKENS.IOfflineSyncService, { useClass: OfflineSyncService });
  container.register(TOKENS.ICrashRecoveryService, { useClass: CrashRecoveryService });
  container.register(TOKENS.IRetentionPolicyService, { useClass: RetentionPolicyService });
  container.register(TOKENS.IEncryptionService, { useClass: EncryptionService });

  // Normalization Services — stateless (ADR-021 Transient First)
  container.register('IFileSystem', { useClass: ExpoFileSystem });
  container.register(AudioConversionService, { useClass: AudioConversionService });
  container.register(CaptureAnalysisService, { useClass: CaptureAnalysisService });

  // Identity Services — stateless (ADR-021 Transient First)
  container.register(UserFeaturesService, { useClass: UserFeaturesService });

  // Upload Infrastructure (Story 6.2 - Task 6-7)
  // Note: AudioUploadService and ChunkedUploadService need API URL
  // They use factory pattern for API URL injection
  container.register(AudioUploadService, {
    useFactory: () => {
      const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      return new AudioUploadService(url);
    },
  });
  container.register(ChunkedUploadService, {
    useFactory: () => {
      const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      return new ChunkedUploadService(url);
    },
  });

  servicesRegistered = true;
  console.log('[DI Container] ✅ Services registered (ADR-021 Transient First applied)');
}
