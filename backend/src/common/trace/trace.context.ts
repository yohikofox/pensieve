/**
 * TraceContext — Story 26.1: Distributed Tracing
 *
 * AsyncLocalStorage singleton pour propager traceId + source
 * sans passer de paramètre explicite dans chaque appel.
 *
 * Usage:
 *   TraceContext.run({ traceId, source }, () => { ... })
 *   TraceContext.getTraceId() // depuis n'importe où dans le contexte
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TraceData {
  traceId: string;
  source: string;
  /** Identifiant du Personal Access Token (Story 27.1) */
  patId?: string;
  /** Identifiant de l'utilisateur associé au PAT (Story 27.1) */
  userId?: string;
}

const storage = new AsyncLocalStorage<TraceData>();

export class TraceContext {
  static getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  }

  static getSource(): string | undefined {
    return storage.getStore()?.source;
  }

  static getPatId(): string | undefined {
    return storage.getStore()?.patId;
  }

  static getUserId(): string | undefined {
    return storage.getStore()?.userId;
  }

  static run<T>(data: TraceData, fn: () => T): T {
    return storage.run(data, fn);
  }

  /**
   * Enrichit le store courant avec les données PAT (Story 27.1).
   * Le store AsyncLocalStorage est un objet mutable — on le modifie in-place.
   */
  static enrichPatContext(patId: string, userId: string): void {
    const store = storage.getStore();
    if (!store) {
      // Guard appelé hors contexte TraceContext.run() — patId/userId non propagés
      console.warn(
        '[TraceContext] enrichPatContext appelé sans store actif — AC10 ne sera pas tracé',
      );
      return;
    }
    store.patId = patId;
    store.userId = userId;
  }
}
