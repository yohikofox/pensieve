/**
 * Unit Tests - ErrorBoundary
 *
 * Story 3.1 - Code Review Follow-up (MEDIUM Priority)
 * Tests React error boundary error catching and recovery
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; error?: Error }> = ({ shouldThrow = true, error }) => {
  if (shouldThrow) {
    throw error || new Error('Test error');
  }
  return <Text>Success</Text>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests (expected errors)
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Test content</Text>
        </ErrorBoundary>
      );

      expect(getByText('Test content')).toBeTruthy();
    });

    it('should not show error UI when children render successfully', () => {
      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(queryByText(/Une erreur est survenue/i)).toBeNull();
      expect(queryByText('Success')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should catch errors and display fallback UI', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(getByText('Une erreur est survenue')).toBeTruthy();
      expect(getByText('Test error')).toBeTruthy();
      expect(getByText('Réessayer')).toBeTruthy();
    });

    it('should display custom error message', () => {
      const customError = new Error('Custom error message');
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError error={customError} />
        </ErrorBoundary>
      );

      expect(getByText('Custom error message')).toBeTruthy();
    });

    it('should log error to console', () => {
      const consoleErrorSpy = console.error as jest.Mock;

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorBoundary]'),
        expect.any(Error),
        expect.anything()
      );
    });

    it('should call onError callback when provided', () => {
      const onErrorMock = jest.fn();

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = (error: Error) => <Text>Custom fallback: {error.message}</Text>;

      const { getByText, queryByText } = render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(getByText('Custom fallback: Test error')).toBeTruthy();
      // Default fallback should not be shown
      expect(queryByText('Une erreur est survenue')).toBeNull();
    });

    it('should provide reset function to custom fallback', () => {
      let capturedReset: (() => void) | null = null;

      const customFallback = (_error: Error, reset: () => void) => {
        capturedReset = reset;
        return <Text>Custom fallback with reset</Text>;
      };

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(capturedReset).toBeTruthy();
      expect(typeof capturedReset).toBe('function');
    });
  });

  describe('Error Icon', () => {
    it('should render alert-triangle icon in fallback UI', () => {
      const { UNSAFE_getByType } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const icon = UNSAFE_getByType('Feather' as any);
      expect(icon).toBeTruthy();
      expect(icon.props.name).toBe('alert-triangle');
    });
  });
});
