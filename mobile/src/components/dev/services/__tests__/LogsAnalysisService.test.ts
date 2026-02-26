/**
 * Unit tests for LogsAnalysisService
 *
 * Story 7.3 — LLM Logs Analysis & GitHub Issues
 * AC2: Extraction et groupement des logs d'erreur
 * AC3: Analyse LLM (mocked)
 *
 * Run: npx jest src/components/dev/services/__tests__/LogsAnalysisService.test.ts
 */

import 'reflect-metadata';

// Mock tsyringe
jest.mock('tsyringe', () => ({
  injectable: () => jest.fn(),
  inject: () => jest.fn(),
}));

// Mock LLM backends
jest.mock('../../../../contexts/Normalization/services/postprocessing/LlamaRnBackend', () => ({
  LlamaRnBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isModelLoaded: jest.fn().mockReturnValue(true),
    loadModel: jest.fn().mockResolvedValue(true),
    processWithCustomPrompt: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../../contexts/Normalization/services/postprocessing/MediaPipeBackend', () => ({
  MediaPipeBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    isModelLoaded: jest.fn().mockReturnValue(false),
    loadModel: jest.fn().mockResolvedValue(false),
    processWithCustomPrompt: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../../contexts/Normalization/services/postprocessing/LitertLmBackend', () => ({
  LitertLmBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    isModelLoaded: jest.fn().mockReturnValue(false),
    loadModel: jest.fn().mockResolvedValue(false),
    processWithCustomPrompt: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { LogsAnalysisService } from '../LogsAnalysisService';
import type { LogEntry } from '../../stores/logsDebugStore';
import { RepositoryResultType } from '../../../../contexts/shared/domain/Result';

function makeLog(level: 'log' | 'error' | 'warn', message: string): LogEntry {
  return { timestamp: new Date(), level, message };
}

describe('LogsAnalysisService', () => {
  let service: LogsAnalysisService;
  let mockModelService: jest.Mocked<{
    isPostProcessingEnabled: () => Promise<boolean>;
    getBestAvailableModelForTask: (task: string) => Promise<string | null>;
    getModelConfig: (id: string) => { backend: string; promptTemplate?: string };
    getModelPath: (id: string) => string;
  }>;

  beforeEach(() => {
    mockModelService = {
      isPostProcessingEnabled: jest.fn().mockResolvedValue(true),
      getBestAvailableModelForTask: jest.fn().mockResolvedValue('smollm-135m'),
      getModelConfig: jest.fn().mockReturnValue({ backend: 'llamarn', promptTemplate: undefined }),
      getModelPath: jest.fn().mockReturnValue('/models/smollm-135m.gguf'),
    };

    // @ts-ignore — inject mock directly
    service = new LogsAnalysisService(mockModelService);
  });

  describe('groupErrorLogs (AC2)', () => {
    it('filters only error level logs', () => {
      const logs: LogEntry[] = [
        makeLog('log', 'info message'),
        makeLog('error', 'error 1'),
        makeLog('warn', 'warning'),
        makeLog('error', 'error 2'),
      ];

      const result = service.groupErrorLogs(logs);
      expect(result).toHaveLength(2);
      result.forEach(log => expect(log.level).toBe('error'));
    });

    it('limits to 20 most recent errors', () => {
      const logs: LogEntry[] = Array.from({ length: 30 }, (_, i) =>
        makeLog('error', `error-${i}`)
      );

      const result = service.groupErrorLogs(logs);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('keeps the most recent 20 errors (not oldest)', () => {
      const logs: LogEntry[] = Array.from({ length: 30 }, (_, i) =>
        makeLog('error', `error-${i}`)
      );

      const result = service.groupErrorLogs(logs);
      // Should keep the last 20 (indices 10-29 after pattern dedup)
      expect(result.some(l => l.message === 'error-29')).toBe(true);
    });

    it('groups by similar pattern (deduplication)', () => {
      const logs: LogEntry[] = [
        makeLog('error', 'TypeError: cannot read property X of undefined'),
        makeLog('error', 'TypeError: cannot read property X of undefined'),
        makeLog('error', 'TypeError: cannot read property X of undefined'),
        makeLog('error', 'ReferenceError: Y is not defined'),
      ];

      const result = service.groupErrorLogs(logs);
      // Duplicates of same pattern should be removed
      expect(result.length).toBeLessThan(4);
      // Both unique patterns should be present
      expect(result.some(l => l.message.startsWith('TypeError'))).toBe(true);
      expect(result.some(l => l.message.startsWith('ReferenceError'))).toBe(true);
    });

    it('returns empty array when no error logs', () => {
      const logs: LogEntry[] = [
        makeLog('log', 'info'),
        makeLog('warn', 'warning'),
      ];

      const result = service.groupErrorLogs(logs);
      expect(result).toHaveLength(0);
    });
  });

  describe('analyzeLogs (AC3)', () => {
    it('returns businessError when no error logs provided', async () => {
      const logs: LogEntry[] = [makeLog('log', 'info only')];
      const result = await service.analyzeLogs(logs);
      expect(result.type).toBe(RepositoryResultType.BUSINESS_ERROR);
    });

    it('returns businessError when LLM not enabled', async () => {
      mockModelService.isPostProcessingEnabled.mockResolvedValue(false);

      const logs: LogEntry[] = [makeLog('error', 'some error')];
      const result = await service.analyzeLogs(logs);
      expect(result.type).toBe(RepositoryResultType.BUSINESS_ERROR);
    });

    it('returns businessError when no model available', async () => {
      mockModelService.getBestAvailableModelForTask.mockResolvedValue(null);

      const logs: LogEntry[] = [makeLog('error', 'some error')];
      const result = await service.analyzeLogs(logs);
      expect(result.type).toBe(RepositoryResultType.BUSINESS_ERROR);
    });

    it('parses valid JSON response from LLM', async () => {
      const { LlamaRnBackend } = require('../../../../contexts/Normalization/services/postprocessing/LlamaRnBackend');
      const mockBackend = new LlamaRnBackend();
      mockBackend.processWithCustomPrompt.mockResolvedValueOnce({
        text: JSON.stringify({
          title: 'Bug: crash on startup',
          body: '## Summary\n\nThe app crashes on startup.',
          labels: ['bug', 'crash'],
          severity: 'high',
        }),
        processingDuration: 3000,
        backend: 'llamarn',
        model: '/models/test.gguf',
      });

      // Reinitialize with mock backend
      (service as any).backend = mockBackend;
      (service as any).isInitialized = true;

      const logs: LogEntry[] = [makeLog('error', 'App crashed: null pointer exception')];
      const result = await service.analyzeLogs(logs);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.title).toBe('Bug: crash on startup');
      expect(result.data?.severity).toBe('high');
      expect(result.data?.labels).toContain('bug');
    });

    it('extracts JSON from LLM response with surrounding text', async () => {
      const { LlamaRnBackend } = require('../../../../contexts/Normalization/services/postprocessing/LlamaRnBackend');
      const mockBackend = new LlamaRnBackend();
      mockBackend.processWithCustomPrompt.mockResolvedValueOnce({
        text: 'Here is the JSON:\n{"title":"Bug: test","body":"description","labels":["bug"],"severity":"medium"}\nEnd.',
        processingDuration: 2000,
        backend: 'llamarn',
        model: '/models/test.gguf',
      });

      (service as any).backend = mockBackend;
      (service as any).isInitialized = true;

      const logs: LogEntry[] = [makeLog('error', 'some error')];
      const result = await service.analyzeLogs(logs);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.title).toBe('Bug: test');
    });

    it('returns businessError when LLM returns invalid JSON', async () => {
      const { LlamaRnBackend } = require('../../../../contexts/Normalization/services/postprocessing/LlamaRnBackend');
      const mockBackend = new LlamaRnBackend();
      mockBackend.processWithCustomPrompt.mockResolvedValueOnce({
        text: 'not valid json at all',
        processingDuration: 1000,
        backend: 'llamarn',
        model: '/models/test.gguf',
      });

      (service as any).backend = mockBackend;
      (service as any).isInitialized = true;

      const logs: LogEntry[] = [makeLog('error', 'some error')];
      const result = await service.analyzeLogs(logs);

      expect(result.type).toBe(RepositoryResultType.BUSINESS_ERROR);
    });
  });
});
