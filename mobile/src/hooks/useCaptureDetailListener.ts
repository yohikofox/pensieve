/**
 * useCaptureDetailListener Hook
 *
 * Listens to EventBus events for a specific capture and triggers reload callback.
 * Replaces polling with event-driven updates.
 *
 * Usage:
 * ```tsx
 * function CaptureDetailScreen() {
 *   useCaptureDetailListener(captureId, loadCapture);
 * }
 * ```
 */

import { useEffect } from 'react';
import { container } from 'tsyringe';
import { EventBus } from '../contexts/shared/events/EventBus';
import type {
  QueueItemCompletedEvent,
  QueueItemFailedEvent,
  QueueItemStartedEvent,
} from '../contexts/Normalization/events/QueueEvents';
import type {
  CaptureUpdatedEvent,
  CaptureDeletedEvent,
} from '../contexts/capture/events/CaptureEvents';

/**
 * Hook that listens to events for a specific capture and triggers reload
 * @param captureId - ID of the capture to monitor
 * @param onReload - Callback to reload capture data
 */
export function useCaptureDetailListener(
  captureId: string,
  onReload?: () => void | Promise<void>
) {
  useEffect(() => {
    if (!onReload) {
      // Listener is active but has no reload callback yet
      return;
    }

    console.log('[CaptureDetailListener] 🎧 Starting listeners for:', captureId);

    const eventBus = container.resolve<EventBus>('EventBus');

    // Transcription started
    const handleStarted = (event: QueueItemStartedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 🚀 Transcription started - reloading');
        onReload();
      }
    };

    // Transcription completed
    const handleCompleted = (event: QueueItemCompletedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 📝 Transcription completed - reloading');
        onReload();
      }
    };

    // Transcription failed
    const handleFailed = (event: QueueItemFailedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] ❌ Transcription failed - reloading');
        onReload();
      }
    };

    // Capture updated manually
    const handleUpdated = (event: CaptureUpdatedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 📝 Capture updated - reloading');
        onReload();
      }
    };

    // Capture deleted
    const handleDeleted = (event: CaptureDeletedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 🗑️ Capture deleted');
        // Navigation handled by screen
      }
    };

    // Subscribe to events
    const subscriptions = [
      eventBus.subscribe<QueueItemStartedEvent>('QueueItemStarted', handleStarted),
      eventBus.subscribe<QueueItemCompletedEvent>('QueueItemCompleted', handleCompleted),
      eventBus.subscribe<QueueItemFailedEvent>('QueueItemFailed', handleFailed),
      eventBus.subscribe<CaptureUpdatedEvent>('CaptureUpdated', handleUpdated),
      eventBus.subscribe<CaptureDeletedEvent>('CaptureDeleted', handleDeleted),
    ];

    console.log('[CaptureDetailListener] ✓ Listeners active');

    // Cleanup on unmount
    return () => {
      console.log('[CaptureDetailListener] 🛑 Stopping listeners');
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [captureId, onReload]);
}
