/**
 * Deep Link Service Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 7, Subtasks 7.2-7.6: Deep link handler tests
 */

import { DeepLinkService } from '../DeepLinkService';
import * as Linking from 'expo-linking';

// Mock expo-linking
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
  parse: jest.fn(),
}));

describe('DeepLinkService', () => {
  let service: DeepLinkService;
  let mockNavigationRef: any;

  beforeEach(() => {
    // Clear all mocks before creating new instances
    jest.clearAllMocks();

    // Reset mock implementations to avoid state leakage
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (Linking.parse as jest.Mock).mockReturnValue({
      hostname: '',
      path: '',
      queryParams: {},
    });
    (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

    // Create fresh service instance
    service = new DeepLinkService();

    // Create fresh navigation ref
    mockNavigationRef = {
      isReady: jest.fn().mockReturnValue(true),
      navigate: jest.fn(),
    };
  });

  describe('initialize', () => {
    it('should set up deep link listener and handle initial URL', async () => {
      (Linking.getInitialURL as jest.Mock).mockResolvedValue('pensieve://capture/123');
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/123',
        queryParams: {},
      });
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      const cleanup = service.initialize(mockNavigationRef);

      // Wait for async getInitialURL to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(Linking.getInitialURL).toHaveBeenCalled();
      expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: '123',
          highlightInsights: true,
          fromNotification: true,
        },
      });

      cleanup();
    });

    it('should handle URL change when app is in foreground (Subtask 7.4)', () => {
      let urlChangeHandler: ((event: { url: string }) => void) | null = null;

      (Linking.addEventListener as jest.Mock).mockImplementation((event, handler) => {
        urlChangeHandler = handler;
        return { remove: jest.fn() };
      });

      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/456',
        queryParams: {},
      });

      service.initialize(mockNavigationRef);

      // Simulate URL change event (app in foreground/background)
      urlChangeHandler?.({ url: 'pensieve://capture/456' });

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: '456',
          highlightInsights: true,
          fromNotification: true,
        },
      });
    });
  });

  describe('deep link parsing (Subtask 7.2)', () => {
    it('should parse capture deep link: pensieve://capture/:captureId', async () => {
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/789',
        queryParams: {},
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('pensieve://capture/789');
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: '789',
          highlightInsights: true,
          fromNotification: true,
        },
      });
    });

    it('should handle capture ID without leading slash', async () => {
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: 'abc-123',
        queryParams: {},
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('pensieve://capture/abc-123');
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: 'abc-123',
          highlightInsights: true,
          fromNotification: true,
        },
      });
    });
  });

  describe('navigation to CaptureDetail (Subtask 7.3)', () => {
    it('should navigate to CaptureDetail with highlightInsights=true (AC4)', async () => {
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/highlight-test',
        queryParams: {},
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue(
        'pensieve://capture/highlight-test',
      );
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: 'highlight-test',
          highlightInsights: true,
          fromNotification: true,
        },
      });
    });

    it('should mark navigation as fromNotification=true', async () => {
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/notif-source',
        queryParams: {},
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('pensieve://capture/notif-source');
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const call = (mockNavigationRef.navigate as jest.Mock).mock.calls[0];
      expect(call[1].params.fromNotification).toBe(true);
    });
  });

  describe('edge cases (Subtask 7.6)', () => {
    it('should NOT navigate if navigation ref not ready', () => {
      mockNavigationRef.isReady.mockReturnValue(false);

      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/pending',
        queryParams: {},
      });
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);
      service['handleURL']('pensieve://capture/pending', 'notification');

      // Should not navigate yet
      expect(mockNavigationRef.navigate).not.toHaveBeenCalled();

      // Should queue the pending link
      expect(service['pendingLink']).toEqual({
        type: 'capture',
        captureId: 'pending',
        sourceType: 'notification',
      });
    });

    it('should handle navigation when becoming ready with pending link', () => {
      // Configure mocks before any calls
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'capture',
        path: '/pending',
        queryParams: {},
      });
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      // First: Initialize with navigation not ready
      mockNavigationRef.isReady.mockReturnValue(false);
      service.initialize(mockNavigationRef);

      // Trigger a deep link while navigation not ready
      service['handleURL']('pensieve://capture/pending', 'notification');

      // Should not navigate yet
      expect(mockNavigationRef.navigate).not.toHaveBeenCalled();

      // Verify link was queued
      expect(service['pendingLink']).toEqual({
        type: 'capture',
        captureId: 'pending',
        sourceType: 'notification',
      });

      // Second: Navigation becomes ready - reinitialize
      mockNavigationRef.isReady.mockReturnValue(true);
      service.initialize(mockNavigationRef);

      // Should now navigate with pending link
      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: 'pending',
          highlightInsights: true,
          fromNotification: true,
        },
      });
    });

    it('should handle invalid deep link gracefully', async () => {
      (Linking.parse as jest.Mock).mockReturnValue({
        hostname: 'invalid',
        path: null,
        queryParams: {},
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('pensieve://invalid');
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      // Should not throw
      await expect(new Promise((resolve) => setTimeout(resolve, 10))).resolves.not.toThrow();
      expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
    });

    it('should handle Linking.parse error gracefully', async () => {
      (Linking.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      (Linking.getInitialURL as jest.Mock).mockResolvedValue('malformed://url');
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);

      // Should not throw
      await expect(new Promise((resolve) => setTimeout(resolve, 10))).resolves.not.toThrow();
      expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigateToCapture (programmatic navigation)', () => {
    it('should navigate to capture programmatically', () => {
      (Linking.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });

      service.initialize(mockNavigationRef);
      service.navigateToCapture('manual-123');

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: 'manual-123',
          highlightInsights: true,
          fromNotification: false, // external source
        },
      });
    });
  });
});
