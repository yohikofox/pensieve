import 'reflect-metadata';

// Mock NetInfo BEFORE imports
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

// Mock DatabaseConnection BEFORE SyncService import
jest.mock('../../../database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        execute: jest.fn(),
      })),
    })),
  },
}));

import { AutoSyncOrchestrator } from '../AutoSyncOrchestrator';
import { NetworkMonitor } from '../../network/NetworkMonitor';
import { SyncService } from '../SyncService';
import { SyncResult } from '../types';

// Mock dependencies
jest.mock('../../network/NetworkMonitor');
jest.mock('../SyncService');

describe('AutoSyncOrchestrator', () => {
  let orchestrator: AutoSyncOrchestrator;
  let mockNetworkMonitor: jest.Mocked<NetworkMonitor>;
  let mockSyncService: jest.Mocked<SyncService>;
  let networkChangeHandler: (isConnected: boolean) => void;

  beforeEach(() => {
    // Setup mocks
    mockNetworkMonitor = new NetworkMonitor() as jest.Mocked<NetworkMonitor>;
    mockSyncService = new SyncService(
      'http://localhost:3000',
    ) as jest.Mocked<SyncService>;

    // Capture network change handler
    mockNetworkMonitor.addListener = jest.fn((handler) => {
      networkChangeHandler = handler;
      return jest.fn(); // Return cleanup function
    });

    mockNetworkMonitor.start = jest.fn();
    mockNetworkMonitor.stop = jest.fn();

    mockSyncService.sync = jest.fn();

    orchestrator = new AutoSyncOrchestrator(
      mockNetworkMonitor,
      mockSyncService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start()', () => {
    it('should start network monitoring and subscribe to changes', () => {
      orchestrator.start();

      expect(mockNetworkMonitor.addListener).toHaveBeenCalledTimes(1);
      expect(mockNetworkMonitor.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(mockNetworkMonitor.start).toHaveBeenCalledTimes(1);
    });

    it('should not start twice if already started', () => {
      orchestrator.start();
      orchestrator.start();

      expect(mockNetworkMonitor.start).toHaveBeenCalledTimes(1);
      expect(mockNetworkMonitor.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('should stop network monitoring and cleanup listener', () => {
      const mockCleanup = jest.fn();
      mockNetworkMonitor.addListener = jest.fn(() => mockCleanup);

      orchestrator.start();
      orchestrator.stop();

      expect(mockCleanup).toHaveBeenCalledTimes(1);
      expect(mockNetworkMonitor.stop).toHaveBeenCalledTimes(1);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      orchestrator.start();
      orchestrator.stop();
      orchestrator.stop();

      // Should only stop once
      expect(mockNetworkMonitor.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Auto-sync behavior (AC1)', () => {
    it('should trigger sync when network comes online', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: Date.now(),
      });

      orchestrator.start();

      // Simulate network coming online
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'high',
      });
    });

    it('should NOT trigger sync when network goes offline', async () => {
      orchestrator.start();

      // Simulate network going offline
      await networkChangeHandler(false);

      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });

    it('should handle sync success with conflicts', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: Date.now(),
        conflicts: [
          {
            entity: 'todos',
            id: 'todo-1',
            serverVersion: { id: 'todo-1', title: 'Server version' },
          },
        ],
      });

      // Mock console.warn to check for conflict warning
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation();

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 conflicts resolved'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle sync failure (retryable)', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.NETWORK_ERROR,
        error: 'Network timeout',
        retryable: true,
      });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-sync failed'),
        'Network timeout',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync will be retried'),
      );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle sync failure (non-retryable)', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.AUTH_ERROR,
        error: 'Invalid token',
        retryable: false,
      });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-sync failed'),
        'Invalid token',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle sync exception gracefully', async () => {
      mockSyncService.sync.mockRejectedValue(new Error('Unexpected error'));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-sync exception'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should trigger sync multiple times if network flaps online multiple times', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: Date.now(),
      });

      orchestrator.start();

      // Simulate network flapping: online → offline → online → offline → online
      await networkChangeHandler(true); // 1st online
      await networkChangeHandler(false);
      await networkChangeHandler(true); // 2nd online
      await networkChangeHandler(false);
      await networkChangeHandler(true); // 3rd online

      // Should sync 3 times (each online transition)
      expect(mockSyncService.sync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Lifecycle', () => {
    it('should cleanup listener when stopped', () => {
      const mockCleanup = jest.fn();
      mockNetworkMonitor.addListener = jest.fn(() => mockCleanup);

      orchestrator.start();
      orchestrator.stop();

      // Cleanup should have been called
      expect(mockCleanup).toHaveBeenCalledTimes(1);

      // NetworkMonitor.stop should be called (which prevents future handler calls)
      expect(mockNetworkMonitor.stop).toHaveBeenCalledTimes(1);
    });

    it('should be restartable after stop()', async () => {
      mockSyncService.sync.mockResolvedValue({
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: Date.now(),
      });

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);

      orchestrator.stop();
      mockSyncService.sync.mockClear();

      orchestrator.start();
      await networkChangeHandler(true);

      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });
  });
});
