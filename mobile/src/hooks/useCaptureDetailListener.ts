/**
 * useCaptureDetailListener Hook
 *
 * Autonomous hook that listens to EventBus events for the current capture
 * and triggers reload. Reads captureId and reloadCapture from store.
 *
 * Usage:
 * ```tsx
 * function CaptureDetailScreen() {
 *   useCaptureDetailInit(captureId);  // Sets up store
 *   useCaptureDetailListener();        // Reads from store - autonomous
 * }
 * ```
 */

import { useEffect } from 'react';
import { container } from 'tsyringe';
import { EventBus } from '../contexts/shared/events/EventBus';
import { useCaptureDetailStore } from '../stores/captureDetailStore';
import type {
  QueueItemAddedEvent,
  QueueItemCompletedEvent,
  QueueItemFailedEvent,
  QueueItemStartedEvent,
} from '../contexts/Normalization/events/QueueEvents';
import type {
  CaptureUpdatedEvent,
  CaptureDeletedEvent,
} from '../contexts/capture/events/CaptureEvents';

/**
 * Autonomous hook that listens to events for the current capture and triggers reload
 * Reads captureId and reloadCapture from the store (set by useCaptureDetailInit)
 */
export function useCaptureDetailListener() {
  // Read from store - autonomous pattern
  const captureId = useCaptureDetailStore((state) => state.captureId);
  const reloadCapture = useCaptureDetailStore((state) => state.reloadCapture);
  const setIsInQueue = useCaptureDetailStore((state) => state.setIsInQueue);

  useEffect(() => {
    if (!captureId || !reloadCapture) {
      // Listener is waiting for init to set up the store
      return;
    }

    console.log('[CaptureDetailListener] 🎧 Starting listeners for:', captureId);

    const eventBus = container.resolve<EventBus>('EventBus');

    // Capture added to transcription queue — immediate visual feedback
    const handleAdded = (event: QueueItemAddedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 🎤 Capture added to queue - setting isInQueue');
        setIsInQueue(true);
      }
    };

    // Transcription started
    const handleStarted = (event: QueueItemStartedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 🚀 Transcription started - reloading');
        setIsInQueue(true);
        reloadCapture();
      }
    };

    // Transcription completed
    const handleCompleted = (event: QueueItemCompletedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 📝 Transcription completed - reloading');
        setIsInQueue(false);
        reloadCapture();
      }
    };

    // Transcription failed
    const handleFailed = (event: QueueItemFailedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] ❌ Transcription failed - reloading');
        setIsInQueue(false);
        reloadCapture();
      }
    };

    // Capture updated manually
    const handleUpdated = (event: CaptureUpdatedEvent) => {
      if (event.payload.captureId === captureId) {
        console.log('[CaptureDetailListener] 📝 Capture updated - reloading');
        reloadCapture();
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
      eventBus.subscribe<QueueItemAddedEvent>('QueueItemAdded', handleAdded),
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
  }, [captureId, reloadCapture, setIsInQueue]);
}
