/**
 * Unit Tests - NetworkContext
 *
 * Story 3.1 - Code Review Follow-up (MEDIUM Priority)
 * Tests network status provider functionality
 */

// Mock NetInfo BEFORE imports
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { NetworkProvider, useNetworkStatus } from '../NetworkContext';

describe('NetworkContext', () => {
  let mockNetInfoListener: ((state: NetInfoState) => void) | null = null;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    mockUnsubscribe = jest.fn();
    mockNetInfoListener = null;

    // Mock addEventListener
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockNetInfoListener = listener;
      return mockUnsubscribe;
    });

    // Mock fetch with default online state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      type: 'wifi',
    } as NetInfoState);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should fetch initial network state on mount', async () => {
      const TestComponent = () => {
        const { isConnected } = useNetworkStatus();
        return <Text>{isConnected ? 'online' : 'offline'}</Text>;
      };

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      expect(NetInfo.fetch).toHaveBeenCalled();
    });

    it('should handle initial state when isConnected is true', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi',
      } as NetInfoState);

      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('true-false')).toBeTruthy();
      });
    });

    it('should handle initial state when isConnected is false', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none',
      } as NetInfoState);

      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('false-true')).toBeTruthy();
      });
    });

    it('should handle initial state when isConnected is null (defensive)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: null,
        type: 'unknown',
      } as NetInfoState);

      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Defensive: null should be treated as offline
      await waitFor(() => {
        expect(getByText('false-true')).toBeTruthy();
      });
    });
  });

  describe('Network State Changes', () => {
    it('should update state when network changes to offline', async () => {
      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText, rerender } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(getByText('true-false')).toBeTruthy();
      });

      // Simulate network change to offline
      if (mockNetInfoListener) {
        mockNetInfoListener({
          isConnected: false,
          type: 'none',
        } as NetInfoState);
      }

      rerender(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('false-true')).toBeTruthy();
      });
    });

    it('should update state when network changes to online', async () => {
      // Start offline
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none',
      } as NetInfoState);

      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText, rerender } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Wait for initial offline state
      await waitFor(() => {
        expect(getByText('false-true')).toBeTruthy();
      });

      // Simulate network change to online
      if (mockNetInfoListener) {
        mockNetInfoListener({
          isConnected: true,
          type: 'wifi',
        } as NetInfoState);
      }

      rerender(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('true-false')).toBeTruthy();
      });
    });

    it('should handle null isConnected during network change (defensive)', async () => {
      const TestComponent = () => {
        const { isConnected, isOffline } = useNetworkStatus();
        return <Text>{`${isConnected}-${isOffline}`}</Text>;
      };

      const { getByText, rerender } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Simulate network change with null isConnected
      if (mockNetInfoListener) {
        mockNetInfoListener({
          isConnected: null,
          type: 'unknown',
        } as NetInfoState);
      }

      rerender(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Defensive: null should be treated as offline
      await waitFor(() => {
        expect(getByText('false-true')).toBeTruthy();
      });
    });

    it('should update connectionType when network changes', async () => {
      const TestComponent = () => {
        const { connectionType } = useNetworkStatus();
        return <Text>{connectionType || 'none'}</Text>;
      };

      const { getByText, rerender } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Wait for initial state (wifi)
      await waitFor(() => {
        expect(getByText('wifi')).toBeTruthy();
      });

      // Simulate network change to cellular
      if (mockNetInfoListener) {
        mockNetInfoListener({
          isConnected: true,
          type: 'cellular',
        } as NetInfoState);
      }

      rerender(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('cellular')).toBeTruthy();
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from NetInfo on unmount', () => {
      const TestComponent = () => {
        const { isConnected } = useNetworkStatus();
        return <Text>{isConnected ? 'online' : 'offline'}</Text>;
      };

      const { unmount } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('useNetworkStatus Hook', () => {
    it('should provide network status to child components', async () => {
      const TestComponent = () => {
        const { isConnected, isOffline, connectionType } = useNetworkStatus();
        return (
          <Text>
            {`${isConnected}-${isOffline}-${connectionType}`}
          </Text>
        );
      };

      const { getByText } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      await waitFor(() => {
        expect(getByText('true-false-wifi')).toBeTruthy();
      });
    });
  });
});
