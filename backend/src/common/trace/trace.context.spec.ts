/**
 * Tests unitaires — TraceContext
 * Story 26.1: Distributed Tracing
 *
 * Couvre:
 * - hors contexte → undefined
 * - dans run() → valeurs correctes
 * - isolation entre Promises parallèles
 */

import { TraceContext } from './trace.context';

describe('TraceContext', () => {
  describe('hors contexte AsyncLocalStorage', () => {
    it('getTraceId() retourne undefined', () => {
      expect(TraceContext.getTraceId()).toBeUndefined();
    });

    it('getSource() retourne undefined', () => {
      expect(TraceContext.getSource()).toBeUndefined();
    });
  });

  describe('dans un contexte run()', () => {
    it('getTraceId() retourne la valeur du contexte courant', () => {
      TraceContext.run({ traceId: 'trace-abc', source: 'http' }, () => {
        expect(TraceContext.getTraceId()).toBe('trace-abc');
      });
    });

    it('getSource() retourne la valeur du contexte courant', () => {
      TraceContext.run({ traceId: 'trace-xyz', source: 'mcp' }, () => {
        expect(TraceContext.getSource()).toBe('mcp');
      });
    });

    it('les valeurs sont inaccessibles après la fin du run()', () => {
      TraceContext.run({ traceId: 'trace-temp', source: 'test' }, () => {
        // dans le contexte
      });
      // hors du contexte
      expect(TraceContext.getTraceId()).toBeUndefined();
    });
  });

  describe('isolation entre contextes parallèles', () => {
    it('deux Promise.all() ont des contextes indépendants', async () => {
      const results: Array<{ id: string; traceId: string | undefined }> = [];

      const task = (id: string, traceId: string): Promise<void> =>
        new Promise((resolve) => {
          TraceContext.run({ traceId, source: 'test' }, () => {
            // setImmediate force une sortie de la pile courante
            setImmediate(() => {
              results.push({ id, traceId: TraceContext.getTraceId() });
              resolve();
            });
          });
        });

      await Promise.all([
        task('A', 'trace-for-A'),
        task('B', 'trace-for-B'),
      ]);

      const resultA = results.find((r) => r.id === 'A');
      const resultB = results.find((r) => r.id === 'B');

      expect(resultA?.traceId).toBe('trace-for-A');
      expect(resultB?.traceId).toBe('trace-for-B');
    });

    it('les contextes imbriqués sont correctement isolés', () => {
      TraceContext.run({ traceId: 'outer', source: 'test' }, () => {
        expect(TraceContext.getTraceId()).toBe('outer');

        TraceContext.run({ traceId: 'inner', source: 'test' }, () => {
          expect(TraceContext.getTraceId()).toBe('inner');
        });

        // retour au contexte parent
        expect(TraceContext.getTraceId()).toBe('outer');
      });
    });
  });
});
