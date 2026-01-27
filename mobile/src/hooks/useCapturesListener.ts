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
import { container } from 'tsyringe';
import { EventBus } from '../contexts/shared/events/EventBus';
import { useCapturesStore } from '../stores/capturesStore';
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

/**
 * Hook qui synchronise les événements du EventBus avec le CapturesStore
 */
export function useCapturesListener() {
  useEffect(() => {
    console.log('[CapturesListener] 🎧 Starting event listeners...');

    // Résoudre l'instance singleton d'EventBus (enregistrée avec clé string)
    const eventBus = container.resolve<EventBus>('EventBus');
    const { updateCapture, addCapture, removeCapture } = useCapturesStore.getState();

    // Nouvelle capture enfilée pour transcription (= capture audio créée)
    const handleAdded = (event: QueueItemAddedEvent) => {
      console.log('[CapturesListener] 🎤 New capture added to queue:', event.payload.captureId);
      updateCapture(event.payload.captureId);
    };

    // Transcription terminée avec succès
    const handleCompleted = (event: QueueItemCompletedEvent) => {
      console.log('[CapturesListener] 📝 Transcription completed:', event.payload.captureId);
      updateCapture(event.payload.captureId);
    };

    // Transcription échouée
    const handleFailed = (event: QueueItemFailedEvent) => {
      console.log('[CapturesListener] ❌ Transcription failed:', event.payload.captureId);
      updateCapture(event.payload.captureId);
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

    // S'abonner aux événements
    const subscriptions = [
      eventBus.subscribe<QueueItemAddedEvent>('QueueItemAdded', handleAdded),
      eventBus.subscribe<QueueItemCompletedEvent>('QueueItemCompleted', handleCompleted),
      eventBus.subscribe<QueueItemFailedEvent>('QueueItemFailed', handleFailed),
      eventBus.subscribe<QueueItemStartedEvent>('QueueItemStarted', handleStarted),
      eventBus.subscribe<CaptureRecordedEvent>('CaptureRecorded', handleRecorded),
      eventBus.subscribe<CaptureDeletedEvent>('CaptureDeleted', handleDeleted),
      eventBus.subscribe<CaptureUpdatedEvent>('CaptureUpdated', handleUpdated),
    ];

    console.log('[CapturesListener] ✓ Event listeners active');

    // Cleanup au unmount
    return () => {
      console.log('[CapturesListener] 🛑 Stopping event listeners...');
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, []); // Deps vides = s'abonne une seule fois au mount
}
