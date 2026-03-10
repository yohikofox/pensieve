/**
 * Tests unitaires — TraceMiddleware
 * Story 26.1: Distributed Tracing
 *
 * Couvre:
 * - Propagation du header X-Trace-ID existant
 * - Génération UUID si X-Trace-ID absent
 * - Setter du header X-Trace-ID en réponse
 * - Extraction de X-Request-Source valide
 * - Fallback 'unknown' si X-Request-Source absent ou invalide
 * - Log d'ingress avec method, path, ip
 * - Propagation via AsyncLocalStorage
 */

import { randomUUID } from 'crypto';
import { TraceContext } from './trace.context';
import { TraceMiddleware } from './trace.middleware';

// UUID v4 pattern
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildMockRequest(headers: Record<string, string> = {}) {
  return {
    headers,
    method: 'GET',
    path: '/api/test',
    ip: '127.0.0.1',
  } as unknown as import('express').Request;
}

function buildMockResponse() {
  const setHeaders: Record<string, string> = {};
  return {
    setHeader(name: string, value: string) {
      setHeaders[name.toLowerCase()] = value;
    },
    _headers: setHeaders,
  } as unknown as import('express').Response & { _headers: Record<string, string> };
}

function buildMockLogger() {
  return {
    info: jest.fn(),
  } as unknown as import('nestjs-pino').PinoLogger;
}

function buildMiddleware() {
  const logger = buildMockLogger();
  // Bypass DI : accès direct à la propriété privée via cast
  const middleware = new (TraceMiddleware as unknown as new (l: unknown) => TraceMiddleware)(logger);
  return { middleware, logger };
}

describe('TraceMiddleware', () => {
  describe('Extraction du traceId (AC1)', () => {
    it('génère un UUID v4 si X-Trace-ID absent', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({});
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        const traceId = TraceContext.getTraceId();
        expect(traceId).toMatch(UUID_V4_REGEX);
        done();
      });
    });

    it('utilise le header X-Trace-ID fourni', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({ 'x-trace-id': 'supplied-trace-id' });
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(TraceContext.getTraceId()).toBe('supplied-trace-id');
        done();
      });
    });

    it('ignore un header X-Trace-ID vide et génère un UUID', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({ 'x-trace-id': '' });
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(TraceContext.getTraceId()).toMatch(UUID_V4_REGEX);
        done();
      });
    });
  });

  describe('Header de réponse X-Trace-ID (AC2)', () => {
    it('ajoute le header X-Trace-ID dans la réponse', (done) => {
      const { middleware } = buildMiddleware();
      const traceId = randomUUID();
      const req = buildMockRequest({ 'x-trace-id': traceId });
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(res._headers['x-trace-id']).toBe(traceId);
        done();
      });
    });
  });

  describe('Extraction de la source (AC3)', () => {
    it('utilise "unknown" si X-Request-Source absent', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({});
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(TraceContext.getSource()).toBe('unknown');
        done();
      });
    });

    it.each(['mcp', 'mobile', 'web', 'admin', 'unknown'] as const)(
      'accepte la source valide "%s"',
      (validSource, done: jest.DoneCallback) => {
        const { middleware } = buildMiddleware();
        const req = buildMockRequest({ 'x-request-source': validSource });
        const res = buildMockResponse();

        middleware.use(req, res, () => {
          expect(TraceContext.getSource()).toBe(validSource);
          (done as jest.DoneCallback)();
        });
      },
    );

    it('remplace une source invalide par "unknown"', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({ 'x-request-source': 'invalid-source' });
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(TraceContext.getSource()).toBe('unknown');
        done();
      });
    });
  });

  describe('Log d\'ingress (AC4)', () => {
    it('émet un log avec traceId, source, method, path, ip', (done) => {
      const { middleware, logger } = buildMiddleware();
      const req = {
        headers: { 'x-trace-id': 'log-test-id', 'x-request-source': 'mcp' },
        method: 'POST',
        path: '/api/captures',
        ip: '10.0.0.1',
      } as unknown as import('express').Request;
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            traceId: 'log-test-id',
            source: 'mcp',
            method: 'POST',
            path: '/api/captures',
            ip: '10.0.0.1',
          }),
          'incoming request',
        );
        done();
      });
    });
  });

  describe('Propagation AsyncLocalStorage (AC5)', () => {
    it('TraceContext.getTraceId() accessible dans next()', (done) => {
      const { middleware } = buildMiddleware();
      const req = buildMockRequest({ 'x-trace-id': 'als-test-id' });
      const res = buildMockResponse();

      middleware.use(req, res, () => {
        expect(TraceContext.getTraceId()).toBe('als-test-id');
        expect(TraceContext.getSource()).toBe('unknown');
        done();
      });
    });
  });
});
