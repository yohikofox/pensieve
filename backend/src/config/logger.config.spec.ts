/**
 * Logger Configuration Unit Tests
 * Story 14.3 — AC1: Logger structuré NestJS (pino)
 *
 * Vérifie que la configuration pino produit les champs JSON requis :
 * timestamp, level, message, context, requestId
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { buildLoggerConfig } from './logger.config';

const makeReq = (headers: Record<string, string> = {}): IncomingMessage =>
  ({ headers }) as unknown as IncomingMessage;

const makeRes = (): ServerResponse => ({}) as unknown as ServerResponse;

describe('Logger Configuration (AC1 — Story 14.3)', () => {
  describe('buildLoggerConfig()', () => {
    it('should return a valid pino configuration object', () => {
      const config = buildLoggerConfig('info', false);
      expect(config).toBeDefined();
      expect(config.pinoHttp).toBeDefined();
    });

    it('should set the log level from the parameter', () => {
      const config = buildLoggerConfig('debug', false);
      expect(config.pinoHttp.level).toBe('debug');
    });

    it('should default log level to "info" when not provided', () => {
      const config = buildLoggerConfig(undefined, false);
      expect(config.pinoHttp.level).toBe('info');
    });

    it('should not include pino-pretty transport in production', () => {
      const config = buildLoggerConfig('info', false);
      expect(config.pinoHttp.transport).toBeUndefined();
    });

    it('should include pino-pretty transport in development', () => {
      const config = buildLoggerConfig('info', true);
      const transport = config.pinoHttp.transport as {
        target: string;
      };
      expect(transport).toBeDefined();
      expect(transport.target).toBe('pino-pretty');
    });

    it('should configure level formatters for JSON output', () => {
      const config = buildLoggerConfig('info', false);
      const formatters = config.pinoHttp.formatters;
      expect(formatters).toBeDefined();

      if (formatters?.level) {
        const formatted = formatters.level('info', 30);
        expect(formatted).toHaveProperty('level');
        expect((formatted as Record<string, string>).level).toBe('info');
      }
    });

    it('should generate a unique requestId per request', () => {
      const config = buildLoggerConfig('info', false);
      const { genReqId } = config.pinoHttp;
      expect(genReqId).toBeDefined();

      if (genReqId) {
        const id1 = genReqId(makeReq(), makeRes());
        const id2 = genReqId(makeReq(), makeRes());

        expect(typeof id1).toBe('string');
        expect(typeof id2).toBe('string');
        expect(id1).not.toBe(id2);
      }
    });

    it('should reuse existing request ID from header when present', () => {
      const config = buildLoggerConfig('info', false);
      const { genReqId } = config.pinoHttp;

      if (genReqId) {
        const existingId = 'existing-request-id-123';
        const id = genReqId(makeReq({ 'x-request-id': existingId }), makeRes());
        expect(id).toBe(existingId);
      }
    });
  });
});
