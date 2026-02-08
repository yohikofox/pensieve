/**
 * Dependency Injection Tokens
 *
 * Symbol-based tokens for TSyringe IoC container.
 * Used to inject dependencies into services and repositories.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-IoC - TSyringe for Dependency Injection
 */

export const TOKENS = {
  // Infrastructure Services
  ILogger: Symbol.for('ILogger'),

  // Domain Repositories
  ICaptureRepository: Symbol.for('ICaptureRepository'),
  ICaptureMetadataRepository: Symbol.for('ICaptureMetadataRepository'),
  ICaptureAnalysisRepository: Symbol.for('ICaptureAnalysisRepository'),
  IThoughtRepository: Symbol.for('IThoughtRepository'),
  IIdeaRepository: Symbol.for('IIdeaRepository'),
  ITodoRepository: Symbol.for('ITodoRepository'),
  IAnalysisTodoRepository: Symbol.for('IAnalysisTodoRepository'),

  // Hardware/Platform Adapters
  IAudioRecorder: Symbol.for('IAudioRecorder'),
  IFileSystem: Symbol.for('IFileSystem'),

  // Application Services
  IPermissionService: Symbol.for('IPermissionService'),
  IFileStorageService: Symbol.for('IFileStorageService'),
  IOfflineSyncService: Symbol.for('IOfflineSyncService'),
  ICrashRecoveryService: Symbol.for('ICrashRecoveryService'),
  ISyncQueueService: Symbol.for('ISyncQueueService'),
  IStorageMonitorService: Symbol.for('IStorageMonitorService'),
  IRetentionPolicyService: Symbol.for('IRetentionPolicyService'),
  IEncryptionService: Symbol.for('IEncryptionService'),

  // LLM Services (Post-Processing)
  IHuggingFaceAuthService: Symbol.for('IHuggingFaceAuthService'),
  ILLMModelService: Symbol.for('ILLMModelService'),
};
