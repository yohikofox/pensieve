/**
 * Pino Logger Configuration for NestJS
 * Story 14.3 — ADR-015: Observability Strategy
 *
 * Produces structured JSON logs with required fields:
 * - time (timestamp)
 * - level
 * - msg (message)
 * - context (NestJS class/module name)
 * - reqId (unique request ID — injected by pino-http)
 */

import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Options as PinoHttpOptions } from 'pino-http';

export interface PinoLoggerConfig {
  pinoHttp: PinoHttpOptions;
}

export function buildLoggerConfig(
  logLevel: string | undefined,
  prettyPrint: boolean,
): PinoLoggerConfig {
  return {
    pinoHttp: {
      level: logLevel ?? 'info',

      formatters: {
        level: (label: string) => ({ level: label }),
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      genReqId: (req: IncomingMessage, _res: ServerResponse): string => {
        const existingId = req.headers['x-request-id'];
        if (typeof existingId === 'string' && existingId.length > 0) {
          return existingId;
        }
        return randomUUID();
      },

      transport: prettyPrint
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      serializers: {
        req: (req: IncomingMessage & { id?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  };
}
