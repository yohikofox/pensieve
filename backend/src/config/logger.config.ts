/**
 * Pino Logger Configuration for NestJS
 * Story 14.3 — ADR-015: Observability Strategy
 *
 * Produces structured JSON logs with required fields:
 * - time (Unix ms timestamp)
 * - level
 * - msg (message)
 * - context (NestJS class/module name)
 * - reqId (unique request ID — injected by pino-http on HTTP requests only)
 *
 * Sensitive data redaction (ADR-015 §15.1 — SensitiveDataFilter):
 * The following fields are automatically redacted to '[REDACTED]' in all logs:
 * - req.headers.authorization (JWT tokens)
 * - req.headers.cookie (session cookies)
 * - email, password, token, transcription, content (PII / private data)
 *
 * Production file logging (optional):
 * Set LOG_FILE_PATH env var to enable dual stdout+file logging.
 * For log rotation, use Docker --log-opt max-size or host-level logrotate.
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
  logFilePath?: string,
): PinoLoggerConfig {
  const level = logLevel ?? 'info';

  // Transport selection:
  // - dev  : pino-pretty (coloured, human-readable)
  // - prod + logFilePath : dual stdout + file (for VM/bare-metal deployments)
  // - prod + no path     : stdout only (recommended for Docker — use log driver)
  let transport: PinoHttpOptions['transport'];
  if (prettyPrint) {
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  } else if (logFilePath) {
    transport = {
      targets: [
        { target: 'pino/file', options: { destination: 1 } }, // stdout
        { target: 'pino/file', options: { destination: logFilePath, mkdir: true } },
      ],
    };
  }
  // else undefined → pino default → stdout (Docker/K8s log driver handles rotation)

  return {
    pinoHttp: {
      level,

      formatters: {
        level: (label: string) => ({ level: label }),
      },

      genReqId: (req: IncomingMessage): string => {
        const existingId = req.headers['x-request-id'];
        if (typeof existingId === 'string' && existingId.length > 0) {
          return existingId;
        }
        return randomUUID();
      },

      // Sensitive data redaction — ADR-015 §15.1
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'email',
          'password',
          'token',
          'transcription',
          'content',
        ],
        censor: '[REDACTED]',
      },

      transport,

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
