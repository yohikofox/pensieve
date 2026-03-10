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
}

const storage = new AsyncLocalStorage<TraceData>();

export class TraceContext {
  static getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  }

  static getSource(): string | undefined {
    return storage.getStore()?.source;
  }

  static run<T>(data: TraceData, fn: () => T): T {
    return storage.run(data, fn);
  }
}
