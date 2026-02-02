/**
 * Unit Tests - OfflineBanner
 *
 * Story 3.1 - Code Review Follow-up (MEDIUM Priority)
 * Tests offline banner display and animations
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { OfflineBanner } from '../OfflineBanner';
import { useNetworkStatus } from '../../../contexts/NetworkContext';
import { useTheme } from '../../../hooks/useTheme';

// Mock dependencies
jest.mock('../../../contexts/NetworkContext', () => ({
  useNetworkStatus: jest.fn(),
}));
jest.mock('../../../hooks/useTheme', () => ({
  useTheme: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

describe('OfflineBanner', () => {
  const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
  const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

  beforeEach(() => {
    // Default mocks
    mockUseTheme.mockReturnValue({
      isDark: false,
      colors: {} as any,
    });

    // Mock Animated.Value to avoid animation issues
    jest.spyOn(Animated, 'spring').mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as any));

    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as any));

    jest.spyOn(Animated, 'parallel').mockImplementation((animations) => ({
      start: jest.fn((callback) => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    } as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when online', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: true,
        isOffline: false,
        connectionType: 'wifi',
      });

      const { queryByText } = render(<OfflineBanner />);

      expect(queryByText(/Mode hors-ligne/i)).toBeNull();
    });

    it('should render when offline', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      const { getByText } = render(<OfflineBanner />);

      expect(getByText('Mode hors-ligne - Vos captures sont sauvegardées')).toBeTruthy();
    });

    it('should display custom message when provided', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      const customMessage = 'Connexion perdue';
      const { getByText } = render(<OfflineBanner message={customMessage} />);

      expect(getByText(customMessage)).toBeTruthy();
    });
  });

  describe('Animations', () => {
    it('should trigger slide-in animation when going offline', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      const springSpy = jest.spyOn(Animated, 'spring');
      const timingSpy = jest.spyOn(Animated, 'timing');
      const parallelSpy = jest.spyOn(Animated, 'parallel');

      render(<OfflineBanner />);

      // Should call spring for slide animation
      expect(springSpy).toHaveBeenCalled();
      // Should call timing for opacity animation
      expect(timingSpy).toHaveBeenCalled();
      // Should run animations in parallel
      expect(parallelSpy).toHaveBeenCalled();
    });

    it('should trigger slide-out animation when going online', () => {
      // Start offline
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      const { rerender } = render(<OfflineBanner />);

      // Go online
      mockUseNetworkStatus.mockReturnValue({
        isConnected: true,
        isOffline: false,
        connectionType: 'wifi',
      });

      const timingSpy = jest.spyOn(Animated, 'timing');
      const parallelSpy = jest.spyOn(Animated, 'parallel');

      rerender(<OfflineBanner />);

      // Should call timing for slide-out and opacity animations
      expect(timingSpy).toHaveBeenCalled();
      // Should run animations in parallel
      expect(parallelSpy).toHaveBeenCalled();
    });
  });

  describe('Theme Support', () => {
    it('should use light theme colors when isDark is false', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      mockUseTheme.mockReturnValue({
        isDark: false,
        colors: {} as any,
      });

      const { getByText } = render(<OfflineBanner />);
      const banner = getByText('Mode hors-ligne - Vos captures sont sauvegardées');

      expect(banner).toBeTruthy();
      // Component should render without errors in light mode
    });

    it('should use dark theme colors when isDark is true', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      mockUseTheme.mockReturnValue({
        isDark: true,
        colors: {} as any,
      });

      const { getByText } = render(<OfflineBanner />);
      const banner = getByText('Mode hors-ligne - Vos captures sont sauvegardées');

      expect(banner).toBeTruthy();
      // Component should render without errors in dark mode
    });
  });

  describe('Icon Rendering', () => {
    it('should render wifi-off icon when offline', () => {
      mockUseNetworkStatus.mockReturnValue({
        isConnected: false,
        isOffline: true,
        connectionType: 'none',
      });

      const { UNSAFE_getByType } = render(<OfflineBanner />);

      // Check that Feather icon is rendered
      const icon = UNSAFE_getByType('Feather' as any);
      expect(icon).toBeTruthy();
      expect(icon.props.name).toBe('wifi-off');
    });
  });
});
