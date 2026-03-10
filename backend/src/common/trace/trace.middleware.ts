/**
 * TraceMiddleware — Story 26.1: Distributed Tracing
 *
 * Extrait X-Trace-ID et X-Request-Source des headers entrants,
 * génère un UUID si absent, puis exécute la suite de la requête
 * dans un contexte AsyncLocalStorage pour propagation automatique.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { TraceContext } from './trace.context';

const ALLOWED_SOURCES = ['mcp', 'mobile', 'web', 'admin', 'unknown'] as const;
type AllowedSource = (typeof ALLOWED_SOURCES)[number];

function isAllowedSource(value: string): value is AllowedSource {
  return (ALLOWED_SOURCES as readonly string[]).includes(value);
}

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(
    @InjectPinoLogger(TraceMiddleware.name)
    private readonly logger: PinoLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const rawTraceId = req.headers['x-trace-id'];
    const traceId =
      typeof rawTraceId === 'string' && rawTraceId.length > 0
        ? rawTraceId
        : randomUUID();

    const rawSource = req.headers['x-request-source'];
    const source: AllowedSource =
      typeof rawSource === 'string' && isAllowedSource(rawSource)
        ? rawSource
        : 'unknown';

    res.setHeader('X-Trace-ID', traceId);

    TraceContext.run({ traceId, source }, () => {
      this.logger.info(
        { traceId, source, method: req.method, path: req.path, ip: req.ip },
        'incoming request',
      );
      next();
    });
  }
}
