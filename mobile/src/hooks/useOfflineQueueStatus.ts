/**
 * useOfflineQueueStatus Hook
 * Story 4.4: Notifications de Progression IA
 * Task 10, Subtask 10.2: Update capture status to "Queued for when online" if offline
 *
 * AC8: Offline Queue Notification
 * - Update capture status when network goes offline
 * - Mark captures as "Queued for when online"
 * - Restore normal status when network returns
 */

import { useEffect, useState, useRef } from 'react';
import { NetworkStatusService } from '../services/network/NetworkStatusService';

export interface OfflineQueueStatus {
  isOffline: boolean;
  offlineCaptureIds: Set<string>;
}

export interface OfflineQueueStatusOptions {
  onOffline?: (captureIds: string[]) => void;
  onOnline?: () => void;
}

/**
 * useOfflineQueueStatus
 *
 * Monitors network status and tracks captures that should be marked as
 * "Queued for when online" when the device is offline.
 *
 * Usage:
 * ```typescript
 * const { isOffline, offlineCaptureIds } = useOfflineQueueStatus({
 *   onOffline: (captureIds) => {
 *     console.log('Offline, queueing:', captureIds);
 *   },
 *   onOnline: () => {
 *     console.log('Back online, processing queue');
 *   }
 * });
 * ```
 */
export const useOfflineQueueStatus = (
  options: OfflineQueueStatusOptions = {}
): OfflineQueueStatus => {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCaptureIds, setOfflineCaptureIds] = useState<Set<string>>(new Set());
  const previousOfflineRef = useRef(false);

  useEffect(() => {
    const networkService = NetworkStatusService.getInstance();

    // Subscribe to network status changes
    const unsubscribe = networkService.subscribe((status) => {
      const nowOffline = !status.isConnected;
      const wasOffline = previousOfflineRef.current;

      // Update state
      setIsOffline(nowOffline);
      previousOfflineRef.current = nowOffline;

      // Offline transition
      if (!wasOffline && nowOffline) {
        // When going offline, call onOffline callback
        if (options.onOffline) {
          setOfflineCaptureIds((currentIds) => {
            options.onOffline?.(Array.from(currentIds));
            return currentIds;
          });
        }
      }

      // Online transition
      if (wasOffline && !nowOffline) {
        // When coming back online, call onOnline callback
        if (options.onOnline) {
          options.onOnline();
        }

        // Clear offline capture IDs (they will be processed normally)
        setOfflineCaptureIds(new Set());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps - options are captured in closure

  return {
    isOffline,
    offlineCaptureIds,
  };
};

/**
 * Helper function to add capture to offline queue
 */
export const addToOfflineQueue = (
  captureId: string,
  setOfflineCaptureIds: React.Dispatch<React.SetStateAction<Set<string>>>
): void => {
  setOfflineCaptureIds((prev) => {
    const next = new Set(prev);
    next.add(captureId);
    return next;
  });
};

/**
 * Helper function to remove capture from offline queue
 */
export const removeFromOfflineQueue = (
  captureId: string,
  setOfflineCaptureIds: React.Dispatch<React.SetStateAction<Set<string>>>
): void => {
  setOfflineCaptureIds((prev) => {
    const next = new Set(prev);
    next.delete(captureId);
    return next;
  });
};

/**
 * Helper function to check if capture is in offline queue
 */
export const isInOfflineQueue = (
  captureId: string,
  offlineCaptureIds: Set<string>
): boolean => {
  return offlineCaptureIds.has(captureId);
};
