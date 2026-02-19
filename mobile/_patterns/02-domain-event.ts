/**
 * PATTERN: Domain Events (ADR-019)
 *
 * Source:
 *   - src/contexts/shared/events/DomainEvent.ts       (interface base)
 *   - src/contexts/shared/events/EventBus.ts          (bus de publication)
 *   - src/contexts/capture/events/CaptureEvents.ts    (exemple concret)
 *
 * RÈGLES:
 * - Nommage en PASSÉ : "CaptureRecorded", PAS "RecordCapture"
 * - Format : <Entité><Action> (ex: ThoughtCreated, TodoCompleted)
 * - Toutes les propriétés en readonly
 * - Le payload contient TOUTES les données (pas de lazy-loading)
 * - Chaque contexte a son propre fichier d'events : <Context>Events.ts
 */

import type { DomainEvent } from '../src/contexts/shared/events/DomainEvent';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Définir un event (dans src/contexts/<ctx>/events/<Ctx>Events.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExampleCreatedEvent extends DomainEvent {
  readonly type: 'ExampleCreated';        // ← string littéral exact (pas générique)
  readonly payload: {
    readonly entityId: string;
    readonly name: string;
    readonly createdAt: number;           // ← Unix ms (pas Date)
  };
}

// Union type du contexte (tous les events d'un contexte)
export type ExampleEvent = ExampleCreatedEvent /* | ExampleDeletedEvent | ... */;

// Type guard (obligatoire pour chaque event)
export function isExampleCreatedEvent(event: DomainEvent): event is ExampleCreatedEvent {
  return event.type === 'ExampleCreated';
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Publier un event (dans un Repository ou Service)
// ─────────────────────────────────────────────────────────────────────────────

import type { EventBus } from '../src/contexts/shared/events/EventBus';

function publishExample(eventBus: EventBus, entityId: string) {
  // Toujours dans un try/catch — la publication ne doit JAMAIS faire échouer
  // l'opération principale
  try {
    const event: ExampleCreatedEvent = {
      type: 'ExampleCreated',
      timestamp: Date.now(),
      payload: {
        entityId,
        name: 'example',
        createdAt: Date.now(),
      },
    };
    eventBus.publish(event);
  } catch (eventError) {
    console.error('[ExampleRepo] Failed to publish ExampleCreated:', eventError);
    // ← Ne pas re-throw. L'event est best-effort.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : S'abonner à un event (dans un Service ou un Processor)
// ─────────────────────────────────────────────────────────────────────────────

import { eventBus } from '../src/contexts/shared/events/EventBus';
import { Subscription } from 'rxjs';

class ExampleProcessor {
  private subscription: Subscription | null = null;

  start() {
    this.subscription = eventBus.subscribe<ExampleCreatedEvent>(
      'ExampleCreated',
      (event) => {
        // event est typé ExampleCreatedEvent ici
        console.log('Processing:', event.payload.entityId);
      }
    );
  }

  stop() {
    // Toujours unsubscribe pour éviter les leaks mémoire
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
}
