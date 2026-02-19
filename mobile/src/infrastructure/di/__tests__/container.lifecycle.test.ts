/**
 * Tests de conformité ADR-021 — "Transient First" pour le container DI
 *
 * Ces tests vérifient que :
 * 1. Les services Transient retournent une nouvelle instance à chaque résolution
 * 2. Les services Singleton conservent la même instance
 * 3. La résolution lazy dans les hooks fonctionne correctement
 *
 * Story: 13.1 - Migrer le Container DI vers Transient First (ADR-021)
 */

import 'reflect-metadata';
import { container as tsyringeContainer, injectable, inject } from 'tsyringe';

// ── Helpers de test ──────────────────────────────────────────────────────────

/** Crée un identifiant unique par instance (pour distinguer instances Transient vs Singleton) */
function createUniqueIdClass() {
  @injectable()
  class UniqueIdService {
    readonly instanceId = Math.random();
  }
  return UniqueIdService;
}

// ── Tests comportement TSyringe (documentation vivante ADR-021) ──────────────

describe('ADR-021 Transient First — comportement TSyringe', () => {
  let testContainer: typeof tsyringeContainer;

  beforeEach(() => {
    testContainer = tsyringeContainer.createChildContainer();
  });

  afterEach(() => {
    testContainer.clearInstances();
  });

  it('register() sans options crée une nouvelle instance à chaque résolution (Transient)', () => {
    const TransientService = createUniqueIdClass();

    testContainer.register(TransientService, { useClass: TransientService });

    const instanceA = testContainer.resolve(TransientService);
    const instanceB = testContainer.resolve(TransientService);

    expect(instanceA).not.toBe(instanceB);
    expect(instanceA.instanceId).not.toBe(instanceB.instanceId);
  });

  it('registerSingleton() retourne toujours la même instance', () => {
    const SingletonService = createUniqueIdClass();

    testContainer.registerSingleton(SingletonService, SingletonService);

    const instanceA = testContainer.resolve(SingletonService);
    const instanceB = testContainer.resolve(SingletonService);

    expect(instanceA).toBe(instanceB);
    expect(instanceA.instanceId).toBe(instanceB.instanceId);
  });

  it('un service Transient avec une dépendance Singleton reçoit la même instance de la dépendance', () => {
    const LOGGER_TOKEN = Symbol('ILogger');

    @injectable()
    class MockLogger {
      readonly instanceId = Math.random();
    }

    @injectable()
    class MockService {
      constructor(@inject(LOGGER_TOKEN) public readonly logger: MockLogger) {}
    }

    testContainer.registerSingleton(LOGGER_TOKEN, MockLogger);
    testContainer.register(MockService, { useClass: MockService });

    const serviceA = testContainer.resolve(MockService);
    const serviceB = testContainer.resolve(MockService);

    // Les services sont différents (Transient)
    expect(serviceA).not.toBe(serviceB);

    // Mais leur dépendance Logger est la même instance (Singleton)
    expect(serviceA.logger).toBe(serviceB.logger);
    expect(serviceA.logger.instanceId).toBe(serviceB.logger.instanceId);
  });

  it('la résolution lazy (pattern hooks) retourne toujours la bonne instance', () => {
    const TransientService = createUniqueIdClass();
    testContainer.register(TransientService, { useClass: TransientService });

    // Simule le pattern de résolution lazy dans les hooks React
    const getService = () => testContainer.resolve(TransientService);

    const instanceA = getService();
    const instanceB = getService();

    // Chaque appel lazy retourne une nouvelle instance Transient
    expect(instanceA).not.toBe(instanceB);
  });
});

// ── Tests de vérification de la configuration container.ts ───────────────────

/**
 * Ces tests importent le vrai container et vérifient que les services
 * documentés dans ADR-021 sont configurés correctement.
 *
 * Nécessite des mocks pour tous les modules natifs Expo/React Native.
 */

// Mocks pour les modules natifs (nécessaires en environnement Node.js)
jest.mock('@/infrastructure/logging/LoggerService', () => ({
  LoggerService: class MockLoggerService {
    debug = jest.fn();
    info = jest.fn();
    warn = jest.fn();
    error = jest.fn();
    createScope = jest.fn().mockReturnThis();
  },
}));

jest.mock('@/contexts/capture/data/CaptureRepository', () => ({
  CaptureRepository: class MockCaptureRepository {},
}));

jest.mock('@/contexts/capture/data/CaptureMetadataRepository', () => ({
  CaptureMetadataRepository: class MockCaptureMetadataRepository {},
}));

jest.mock('@/contexts/capture/data/CaptureAnalysisRepository', () => ({
  CaptureAnalysisRepository: class MockCaptureAnalysisRepository {},
}));

jest.mock('@/contexts/knowledge/data/ThoughtRepository', () => ({
  ThoughtRepository: class MockThoughtRepository {},
}));

jest.mock('@/contexts/knowledge/data/IdeaRepository', () => ({
  IdeaRepository: class MockIdeaRepository {},
}));

jest.mock('@/contexts/action/data/TodoRepository', () => ({
  TodoRepository: class MockTodoRepository {},
}));

jest.mock('@/contexts/action/data/AnalysisTodoRepository', () => ({
  AnalysisTodoRepository: class MockAnalysisTodoRepository {},
}));

jest.mock('@/contexts/identity/data/user-features.repository', () => ({
  UserFeaturesRepository: class MockUserFeaturesRepository {},
}));

jest.mock('@/contexts/capture/services/RecordingService', () => ({
  RecordingService: class MockRecordingService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/capture/services/PermissionService', () => ({
  PermissionService: class MockPermissionService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/capture/services/FileStorageService', () => ({
  FileStorageService: class MockFileStorageService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/capture/services/OfflineSyncService', () => ({
  OfflineSyncService: class MockOfflineSyncService {},
}));

jest.mock('@/contexts/capture/services/CrashRecoveryService', () => ({
  CrashRecoveryService: class MockCrashRecoveryService {},
}));

jest.mock('@/contexts/capture/services/SyncQueueService', () => ({
  SyncQueueService: class MockSyncQueueService {},
}));

jest.mock('@/contexts/capture/services/StorageMonitorService', () => ({
  StorageMonitorService: class MockStorageMonitorService {},
}));

jest.mock('@/contexts/capture/services/RetentionPolicyService', () => ({
  RetentionPolicyService: class MockRetentionPolicyService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/capture/services/EncryptionService', () => ({
  EncryptionService: class MockEncryptionService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/capture/services/WaveformExtractionService', () => ({
  WaveformExtractionService: class MockWaveformExtractionService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/Normalization/adapters/ExpoFileSystem', () => ({
  ExpoFileSystem: class MockExpoFileSystem {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/Normalization/services/AudioConversionService', () => ({
  AudioConversionService: class MockAudioConversionService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/Normalization/services/TranscriptionService', () => ({
  TranscriptionService: class MockTranscriptionService {},
}));

jest.mock('@/contexts/Normalization/services/TranscriptionQueueService', () => ({
  TranscriptionQueueService: class MockTranscriptionQueueService {},
}));

jest.mock('@/contexts/Normalization/processors/TranscriptionQueueProcessor', () => ({
  TranscriptionQueueProcessor: class MockTranscriptionQueueProcessor {},
}));

jest.mock('@/contexts/Normalization/workers/TranscriptionWorker', () => ({
  TranscriptionWorker: class MockTranscriptionWorker {},
}));

jest.mock('@/contexts/Normalization/services/TranscriptionModelService', () => ({
  TranscriptionModelService: class MockTranscriptionModelService {},
}));

jest.mock('@/contexts/Normalization/services/NPUDetectionService', () => ({
  NPUDetectionService: class MockNPUDetectionService {},
}));

jest.mock('@/contexts/Normalization/services/DeviceCapabilitiesService', () => ({
  DeviceCapabilitiesService: class MockDeviceCapabilitiesService {},
}));

jest.mock('@/contexts/Normalization/services/LLMModelService', () => ({
  LLMModelService: class MockLLMModelService {},
}));

jest.mock('@/contexts/Normalization/services/PostProcessingService', () => ({
  PostProcessingService: class MockPostProcessingService {},
}));

jest.mock('@/contexts/Normalization/services/HuggingFaceAuthService', () => ({
  HuggingFaceAuthService: class MockHuggingFaceAuthService {},
}));

jest.mock('@/contexts/Normalization/services/CaptureAnalysisService', () => ({
  CaptureAnalysisService: class MockCaptureAnalysisService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/Normalization/services/NativeTranscriptionEngine', () => ({
  NativeTranscriptionEngine: class MockNativeTranscriptionEngine {},
}));

jest.mock('@/contexts/Normalization/services/TranscriptionEngineService', () => ({
  TranscriptionEngineService: class MockTranscriptionEngineService {},
}));

jest.mock('@/contexts/identity/services/user-features.service', () => ({
  UserFeaturesService: class MockUserFeaturesService {
    readonly instanceId = Math.random();
  },
}));

jest.mock('@/contexts/identity/services/SupabaseAuthService', () => ({
  SupabaseAuthService: class MockSupabaseAuthService {},
}));

jest.mock('@/infrastructure/sync/SyncService', () => ({
  SyncService: class MockSyncService {
    constructor(_url: string, _bus: unknown) {}
  },
}));

jest.mock('@/infrastructure/sync/SyncTrigger', () => ({
  SyncTrigger: class MockSyncTrigger {},
}));

jest.mock('@/infrastructure/network/NetworkMonitor', () => ({
  NetworkMonitor: class MockNetworkMonitor {},
}));

jest.mock('@/infrastructure/sync/AutoSyncOrchestrator', () => ({
  AutoSyncOrchestrator: class MockAutoSyncOrchestrator {},
}));

jest.mock('@/infrastructure/upload/AudioUploadService', () => ({
  AudioUploadService: class MockAudioUploadService {
    constructor(_url: string) {}
  },
}));

jest.mock('@/infrastructure/upload/ChunkedUploadService', () => ({
  ChunkedUploadService: class MockChunkedUploadService {
    constructor(_url: string) {}
  },
}));

jest.mock('@/infrastructure/upload/UploadOrchestrator', () => ({
  UploadOrchestrator: class MockUploadOrchestrator {},
}));

jest.mock('@/infrastructure/adapters/ExpoAudioAdapter', () => ({
  ExpoAudioAdapter: class MockExpoAudioAdapter {},
}));

jest.mock('@/infrastructure/adapters/ExpoFileSystemAdapter', () => ({
  ExpoFileSystemAdapter: class MockExpoFileSystemAdapter {},
}));

jest.mock('@/contexts/shared/events/EventBus', () => ({
  eventBus: { subscribe: jest.fn(), publish: jest.fn() },
}));

// ── Imports statiques (hoistés après jest.mock par Jest) ────────────────────
// Note : jest.mock() est hoisté automatiquement avant ces imports

import { TOKENS } from '../tokens';
import { registerServices, container as diContainer } from '../container';
import { RecordingService } from '@/contexts/capture/services/RecordingService';

describe('Container DI — conformité ADR-021 Transient First', () => {
  beforeAll(() => {
    // Enregistrer les services une seule fois (tous les mocks sont déjà en place)
    registerServices();
  });

  afterAll(() => {
    diContainer.clearInstances();
  });

  describe('AC5: Repositories → Transient', () => {
    it('CaptureRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.ICaptureRepository);
      const instanceB = diContainer.resolve(TOKENS.ICaptureRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('CaptureMetadataRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.ICaptureMetadataRepository);
      const instanceB = diContainer.resolve(TOKENS.ICaptureMetadataRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('CaptureAnalysisRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.ICaptureAnalysisRepository);
      const instanceB = diContainer.resolve(TOKENS.ICaptureAnalysisRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('ThoughtRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IThoughtRepository);
      const instanceB = diContainer.resolve(TOKENS.IThoughtRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('IdeaRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IIdeaRepository);
      const instanceB = diContainer.resolve(TOKENS.IIdeaRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('TodoRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.ITodoRepository);
      const instanceB = diContainer.resolve(TOKENS.ITodoRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('AnalysisTodoRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IAnalysisTodoRepository);
      const instanceB = diContainer.resolve(TOKENS.IAnalysisTodoRepository);

      expect(instanceA).not.toBe(instanceB);
    });

    it('UserFeaturesRepository doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IUserFeaturesRepository);
      const instanceB = diContainer.resolve(TOKENS.IUserFeaturesRepository);

      expect(instanceA).not.toBe(instanceB);
    });
  });

  describe('AC5: Services stateless → Transient', () => {
    it('PermissionService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IPermissionService);
      const instanceB = diContainer.resolve(TOKENS.IPermissionService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('FileStorageService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IFileStorageService);
      const instanceB = diContainer.resolve(TOKENS.IFileStorageService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('WaveformExtractionService doit retourner une nouvelle instance à chaque résolution', () => {
      const { WaveformExtractionService: MockWES } = jest.requireMock('@/contexts/capture/services/WaveformExtractionService') as { WaveformExtractionService: new () => object };
      const instanceA = diContainer.resolve<object>(MockWES as any);
      const instanceB = diContainer.resolve<object>(MockWES as any);

      expect(instanceA).not.toBe(instanceB);
    });

    it('OfflineSyncService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IOfflineSyncService);
      const instanceB = diContainer.resolve(TOKENS.IOfflineSyncService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('CrashRecoveryService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.ICrashRecoveryService);
      const instanceB = diContainer.resolve(TOKENS.ICrashRecoveryService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('RetentionPolicyService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IRetentionPolicyService);
      const instanceB = diContainer.resolve(TOKENS.IRetentionPolicyService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('EncryptionService doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve(TOKENS.IEncryptionService);
      const instanceB = diContainer.resolve(TOKENS.IEncryptionService);

      expect(instanceA).not.toBe(instanceB);
    });

    it('ExpoFileSystem (Normalization) doit retourner une nouvelle instance à chaque résolution', () => {
      const instanceA = diContainer.resolve<object>('INormalizationFileSystem');
      const instanceB = diContainer.resolve<object>('INormalizationFileSystem');

      expect(instanceA).not.toBe(instanceB);
    });

    it('AudioConversionService doit retourner une nouvelle instance à chaque résolution', () => {
      const { AudioConversionService: MockACS } = jest.requireMock('@/contexts/Normalization/services/AudioConversionService') as { AudioConversionService: new () => object };
      const instanceA = diContainer.resolve<object>(MockACS as any);
      const instanceB = diContainer.resolve<object>(MockACS as any);

      expect(instanceA).not.toBe(instanceB);
    });

    it('CaptureAnalysisService doit retourner une nouvelle instance à chaque résolution', () => {
      const { CaptureAnalysisService: MockCAS } = jest.requireMock('@/contexts/Normalization/services/CaptureAnalysisService') as { CaptureAnalysisService: new () => object };
      const instanceA = diContainer.resolve<object>(MockCAS as any);
      const instanceB = diContainer.resolve<object>(MockCAS as any);

      expect(instanceA).not.toBe(instanceB);
    });

    it('UserFeaturesService doit retourner une nouvelle instance à chaque résolution', () => {
      const { UserFeaturesService: MockUFS } = jest.requireMock('@/contexts/identity/services/user-features.service') as { UserFeaturesService: new () => object };
      const instanceA = diContainer.resolve<object>(MockUFS as any);
      const instanceB = diContainer.resolve<object>(MockUFS as any);

      expect(instanceA).not.toBe(instanceB);
    });
  });

  describe('AC3: Singletons légitimes conservés', () => {
    it('RecordingService doit retourner la même instance (Singleton — état session actif)', () => {
      const instanceA = diContainer.resolve<RecordingService>(RecordingService);
      const instanceB = diContainer.resolve<RecordingService>(RecordingService);

      expect(instanceA).toBe(instanceB);
    });
  });
});
