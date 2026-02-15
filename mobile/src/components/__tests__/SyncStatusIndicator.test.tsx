/**
 * SyncStatusIndicator Component Tests
 * Story 6.2 - Task 9.6: UI indicator testing
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { useSyncStatusStore } from '@/stores/SyncStatusStore';

describe('SyncStatusIndicator Component (Task 9.6)', () => {
  beforeEach(() => {
    // Reset store before each test
    useSyncStatusStore.getState().reset();
  });

  /**
   * AC: Should display checkmark when synced
   */
  it('should display checkmark icon when status is synced', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSynced(Date.now());

    // ACT
    const { getByText } = render(<SyncStatusIndicator />);

    // ASSERT
    expect(getByText('✓')).toBeTruthy();
  });

  /**
   * AC: Should display spinner when syncing
   */
  it('should display activity indicator when status is syncing', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSyncing();

    // ACT
    const { UNSAFE_getByType } = render(<SyncStatusIndicator />);
    const { ActivityIndicator } = require('react-native');

    // ASSERT
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  /**
   * AC: Should display pending count badge
   */
  it('should display pending count when status is pending', () => {
    // ARRANGE
    useSyncStatusStore.getState().setPending(5);

    // ACT
    const { getByText } = render(<SyncStatusIndicator />);

    // ASSERT
    expect(getByText('5')).toBeTruthy();
  });

  /**
   * AC: Should display error icon
   */
  it('should display error icon when status is error', () => {
    // ARRANGE
    useSyncStatusStore.getState().setError('Network timeout');

    // ACT
    const { getByText } = render(<SyncStatusIndicator />);

    // ASSERT
    expect(getByText('!')).toBeTruthy();
  });

  /**
   * AC: Should display text when showText prop is true
   */
  it('should display status text when showText is enabled', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSyncing();

    // ACT
    const { getByText } = render(<SyncStatusIndicator showText />);

    // ASSERT
    expect(getByText('Syncing...')).toBeTruthy();
  });

  /**
   * AC: Should display "Synced X ago" after sync
   */
  it('should display time elapsed since last sync when synced', () => {
    // ARRANGE
    const pastTime = Date.now() - 120 * 1000; // 2 minutes ago
    useSyncStatusStore.getState().setSynced(pastTime);

    // ACT
    const { getByText } = render(<SyncStatusIndicator showText />);

    // ASSERT
    // Should show "Synced 2m ago" (or "just now" if < 60s)
    const syncedText = getByText(/Synced/);
    expect(syncedText).toBeTruthy();
  });

  /**
   * AC: Should display error message when error status
   */
  it('should display error message when showText is enabled and status is error', () => {
    // ARRANGE
    useSyncStatusStore.getState().setError('Network timeout');

    // ACT
    const { getByText } = render(<SyncStatusIndicator showText />);

    // ASSERT
    expect(getByText('Network timeout')).toBeTruthy();
  });

  /**
   * AC: Should hide text when showText is false (default)
   */
  it('should not display text when showText is false', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSyncing();

    // ACT
    const { queryByText } = render(<SyncStatusIndicator showText={false} />);

    // ASSERT
    expect(queryByText('Syncing...')).toBeNull();
  });

  /**
   * AC: Compact mode should use smaller sizes
   */
  it('should render in compact mode when compact prop is true', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSynced(Date.now());

    // ACT
    const { root } = render(<SyncStatusIndicator compact />);

    // ASSERT
    // Component should render (verify no crash in compact mode)
    expect(root).toBeTruthy();
  });

  /**
   * AC: Should update when store changes
   */
  it('should re-render when sync status changes', () => {
    // ARRANGE
    useSyncStatusStore.getState().setSyncing();
    const { getByText, UNSAFE_getByType, rerender } = render(
      <SyncStatusIndicator />,
    );
    const { ActivityIndicator } = require('react-native');

    // Initial state: syncing
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

    // ACT - Change status
    useSyncStatusStore.getState().setSynced(Date.now());
    rerender(<SyncStatusIndicator />);

    // ASSERT - Should now show checkmark
    expect(getByText('✓')).toBeTruthy();
  });
});
