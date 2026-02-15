/**
 * SyncStatusStore Tests
 *
 * Story 6.2 - Task 9.4: Zustand store for sync status UI
 */

import { useSyncStatusStore } from '../SyncStatusStore';

describe('SyncStatusStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useSyncStatusStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('synced');
    expect(state.lastSyncTime).toBeNull();
    expect(state.pendingCount).toBe(0);
    expect(state.errorMessage).toBeNull();
  });

  it('should set syncing status', () => {
    useSyncStatusStore.getState().setSyncing();
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('syncing');
    expect(state.errorMessage).toBeNull();
  });

  it('should set synced status with timestamp', () => {
    const timestamp = Date.now();

    useSyncStatusStore.getState().setSynced(timestamp);
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('synced');
    expect(state.lastSyncTime).toBe(timestamp);
    expect(state.errorMessage).toBeNull();
  });

  it('should set pending status with count', () => {
    useSyncStatusStore.getState().setPending(5);
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('pending');
    expect(state.pendingCount).toBe(5);
  });

  it('should set error status with message', () => {
    const errorMessage = 'Network timeout';

    useSyncStatusStore.getState().setError(errorMessage);
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe(errorMessage);
  });

  it('should clear error when setting syncing', () => {
    // Set error first
    useSyncStatusStore.getState().setError('Network error');
    expect(useSyncStatusStore.getState().errorMessage).toBe('Network error');

    // Set syncing should clear error
    useSyncStatusStore.getState().setSyncing();
    expect(useSyncStatusStore.getState().errorMessage).toBeNull();
  });

  it('should clear error when setting synced', () => {
    // Set error first
    useSyncStatusStore.getState().setError('Network error');

    // Set synced should clear error
    useSyncStatusStore.getState().setSynced(Date.now());
    expect(useSyncStatusStore.getState().errorMessage).toBeNull();
  });

  it('should handle status transitions correctly', () => {
    // synced → syncing
    useSyncStatusStore.getState().setSyncing();
    expect(useSyncStatusStore.getState().status).toBe('syncing');

    // syncing → synced
    useSyncStatusStore.getState().setSynced(Date.now());
    expect(useSyncStatusStore.getState().status).toBe('synced');

    // synced → pending
    useSyncStatusStore.getState().setPending(3);
    expect(useSyncStatusStore.getState().status).toBe('pending');

    // pending → syncing
    useSyncStatusStore.getState().setSyncing();
    expect(useSyncStatusStore.getState().status).toBe('syncing');

    // syncing → error
    useSyncStatusStore.getState().setError('Failed');
    expect(useSyncStatusStore.getState().status).toBe('error');
  });

  it('should compute time since last sync', () => {
    const oneMinuteAgo = Date.now() - 60 * 1000;

    useSyncStatusStore.getState().setSynced(oneMinuteAgo);

    const timeSince = useSyncStatusStore.getState().getTimeSinceLastSync();
    expect(timeSince).toBeGreaterThanOrEqual(60);
    expect(timeSince).toBeLessThan(65); // Allow 5s tolerance
  });

  it('should return null for time since when never synced', () => {
    const timeSince = useSyncStatusStore.getState().getTimeSinceLastSync();
    expect(timeSince).toBeNull();
  });

  it('should reset to initial state', () => {
    // Set some state
    useSyncStatusStore.getState().setError('Error');
    useSyncStatusStore.getState().setPending(10);
    useSyncStatusStore.getState().setSynced(Date.now());

    // Reset
    useSyncStatusStore.getState().reset();
    const state = useSyncStatusStore.getState();

    expect(state.status).toBe('synced');
    expect(state.lastSyncTime).toBeNull();
    expect(state.pendingCount).toBe(0);
    expect(state.errorMessage).toBeNull();
  });
});
