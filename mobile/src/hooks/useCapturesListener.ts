/**
 * useCapturesListener Hook
 *
 * Custom React hook that synchronizes EventBus events with the CapturesStore.
 * Replaces polling architecture with event-driven updates.
 *
 * Usage:
 * ```tsx
 * function CapturesListScreen() {
 *   useCapturesListener(); // Activate synchronization
 *   const captures = useCapturesStore(state => state.captures);
 * }
 * ```
 *
 * Events monitored:
 * - QueueItemCompleted: Transcription finished successfully
 * - QueueItemFailed: Transcription failed
 * - QueueItemStarted: Transcription started (for UI feedback)
 * - CaptureRecorded: New capture created
 * - CaptureDeleted: Capture removed
 * - CaptureUpdated: Capture metadata changed
 */

import { useEffect } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { container } from 'tsyringe';
import { EventBus } from '../contexts/shared/events/EventBus';
import { useCapturesStore } from '../stores/capturesStore';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import type {
  QueueItemCompletedEvent,
  QueueItemFailedEvent,
  QueueItemStartedEvent,
  QueueItemAddedEvent
} from '../contexts/Normalization/events/QueueEvents';
import type {
  CaptureRecordedEvent,
  CaptureDeletedEvent,
  CaptureUpdatedEvent
} from '../contexts/capture/events/CaptureEvents';
import type { SyncCompletedEvent } from '../infrastructure/sync/events/SyncEvents';

/**
 * Hook qui synchronise les événements du EventBus avec le CapturesStore
 */
export function useCapturesListener() {
  useEffect(() => {
    console.log('[CapturesListener] 🎧 Starting event listeners...');

    // Résoudre l'instance singleton d'EventBus (enregistrée avec clé string)
    const eventBus = container.resolve<EventBus>('EventBus');
    const { updateCapture, addCapture, removeCapture, setIsInQueue } = useCapturesStore.getState();

    // Nouvelle capture enfilée pour transcription (= capture audio créée)
    const handleAdded = (event: QueueItemAddedEvent) => {
      console.log('[CapturesListener] 🎤 New capture added to queue:', event.payload.captureId);
      setIsInQueue(event.payload.captureId, true);
    };

    // Transcription terminée avec succès
    const handleCompleted = (event: QueueItemCompletedEvent) => {
      console.log('[CapturesListener] 📝 Transcription completed:', event.payload.captureId);
      updateCapture(event.payload.captureId);
      setIsInQueue(event.payload.captureId, false);
    };

    // Transcription échouée
    const handleFailed = (event: QueueItemFailedEvent) => {
      console.log('[CapturesListener] ❌ Transcription failed:', event.payload.captureId);
      updateCapture(event.payload.captureId);
      setIsInQueue(event.payload.captureId, false);
    };

    // Transcription démarrée (optionnel - pour afficher "processing")
    const handleStarted = (event: QueueItemStartedEvent) => {
      console.log('[CapturesListener] 🚀 Transcription started:', event.payload.captureId);
      updateCapture(event.payload.captureId);
    };

    // Nouvelle capture enregistrée
    const handleRecorded = async (event: CaptureRecordedEvent) => {
      console.log('[CapturesListener] 🎙️ Capture recorded:', event.payload.captureId);
      // Note: On reload via updateCapture() au lieu d'utiliser event.payload
      // car on veut les données complètes de la DB (avec relations)
      updateCapture(event.payload.captureId);
    };

    // Capture supprimée
    const handleDeleted = (event: CaptureDeletedEvent) => {
      console.log('[CapturesListener] 🗑️ Capture deleted:', event.payload.captureId);
      removeCapture(event.payload.captureId);
    };

    // Capture mise à jour manuellement
    const handleUpdated = (event: CaptureUpdatedEvent) => {
      console.log('[CapturesListener] 📝 Capture updated:', event.payload.captureId);
      updateCapture(event.payload.captureId);
    };

    // Story 6.3 - Task 3.4 & 3.5: Reactive UI update after sync with subtle animation
    const handleSyncCompleted = (event: SyncCompletedEvent) => {
      // Only reload if captures were synced
      if (event.payload.entities.includes('captures')) {
        console.log('[CapturesListener] 🔄 Sync completed, reloading captures...');

        // Task 3.5: Subtle fade-in animation for new items (AC3)
        // LayoutAnimation provides a subtle, system-level animation that's not distracting
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            200, // duration: short for subtlety
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.opacity
          )
        );

        const { loadCaptures } = useCapturesStore.getState();
        loadCaptures(); // Reload all captures from DB
      }
    };

    // S'abonner aux événements
    const subscriptions = [
      eventBus.subscribe<QueueItemAddedEvent>('QueueItemAdded', handleAdded),
      eventBus.subscribe<QueueItemCompletedEvent>('QueueItemCompleted', handleCompleted),
      eventBus.subscribe<QueueItemFailedEvent>('QueueItemFailed', handleFailed),
      eventBus.subscribe<QueueItemStartedEvent>('QueueItemStarted', handleStarted),
      eventBus.subscribe<CaptureRecordedEvent>('CaptureRecorded', handleRecorded),
      eventBus.subscribe<CaptureDeletedEvent>('CaptureDeleted', handleDeleted),
      eventBus.subscribe<CaptureUpdatedEvent>('CaptureUpdated', handleUpdated),
      eventBus.subscribe<SyncCompletedEvent>('SyncCompleted', handleSyncCompleted),
    ];

    console.log('[CapturesListener] ✓ Event listeners active');

    // Cleanup au unmount
    return () => {
      console.log('[CapturesListener] 🛑 Stopping event listeners...');
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, []); // Deps vides = s'abonne une seule fois au mount
}
