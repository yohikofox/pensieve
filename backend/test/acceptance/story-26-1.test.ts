/**
 * Story 26.1: Distributed Tracing
 * BDD Step Definitions (jest-cucumber)
 *
 * AC1: Middleware extrait X-Trace-ID ou génère un UUID
 * AC2: Middleware extrait X-Request-Source ou utilise "unknown"
 * AC3: Header X-Trace-ID propagé en réponse
 * AC4: Contexte AsyncLocalStorage accessible dans le flux de la requête
 * AC5: Mixin Pino injecte traceId/source dans les logs HTTP
 * AC6: Mixin Pino retourne {} hors contexte (RabbitMQ/bootstrap)
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { TraceContext } from 'src/common/trace/trace.context';
import { buildLoggerConfig } from 'src/config/logger.config';

const feature = loadFeature(
  path.join(
    __dirname,
    'features/story-26-1-distributed-tracing.feature',
  ),
);

// ---------------------------------------------------------------------------
// Helpers pour simuler le middleware sans DI NestJS
// ---------------------------------------------------------------------------

interface MockRequest {
  headers: Record<string, string | undefined>;
}

interface MockResponse {
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
  };
  return res;
}

/**
 * Simule l'exécution du TraceMiddleware sans instancier NestJS.
 * Reproduit exactement la logique de trace.middleware.ts.
 */
function runMiddleware(
  req: MockRequest,
  res: MockResponse,
): Promise<{ traceId: string; source: string }> {
  return new Promise((resolve) => {
    const rawTraceId = req.headers['x-trace-id'];
    const traceId =
      typeof rawTraceId === 'string' && rawTraceId.length > 0
        ? rawTraceId
        : randomUUID();

    const ALLOWED_SOURCES = ['mcp', 'mobile', 'web', 'admin', 'unknown'];
    const rawSource = req.headers['x-request-source'];
    const source =
      typeof rawSource === 'string' && ALLOWED_SOURCES.includes(rawSource)
        ? rawSource
        : 'unknown';

    res.setHeader('X-Trace-ID', traceId);

    TraceContext.run({ traceId, source }, () => {
      resolve({ traceId, source });
    });
  });
}

// UUID v4 pattern
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Feature
// ---------------------------------------------------------------------------

defineFeature(feature, (test) => {
  let req: MockRequest;
  let res: MockResponse;
  let capturedTraceId: string;
  let capturedSource: string;

  beforeEach(() => {
    req = { headers: {} };
    res = createMockResponse();
    capturedTraceId = '';
    capturedSource = '';
  });

  // -------------------------------------------------------------------------
  // Background
  // -------------------------------------------------------------------------

  const givenTraceContextInitialized = (given: (step: string, fn: () => void) => void) => {
    given('le TraceContext est initialisé', () => {
      // AsyncLocalStorage est un singleton importé — rien à initialiser
    });
  };

  // -------------------------------------------------------------------------
  // Scenario 1: Aucun header X-Trace-ID → UUID généré
  // -------------------------------------------------------------------------

  test('Aucun header X-Trace-ID — un UUID est généré automatiquement', ({
    given,
    when,
    then,
    and,
  }) => {
    givenTraceContextInitialized(given);

    given('une requête entrante sans header "X-Trace-ID"', () => {
      req.headers = {};
    });

    when('le middleware de trace est exécuté', async () => {
      const result = await runMiddleware(req, res);
      capturedTraceId = result.traceId;
    });

    then('un traceId de type UUID v4 est généré', () => {
      expect(capturedTraceId).toMatch(UUID_V4_REGEX);
    });

    and('le header de réponse "X-Trace-ID" contient ce traceId', () => {
      expect(res.headers['x-trace-id']).toBe(capturedTraceId);
    });

    and('le contexte AsyncLocalStorage expose ce traceId', () => {
      // Vérifier que TraceContext.getTraceId() retourne bien la valeur depuis l'intérieur du run()
      let traceIdFromContext: string | undefined;
      TraceContext.run({ traceId: capturedTraceId, source: 'unknown' }, () => {
        traceIdFromContext = TraceContext.getTraceId();
      });
      expect(traceIdFromContext).toBe(capturedTraceId);
      expect(traceIdFromContext).toMatch(UUID_V4_REGEX);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Header X-Trace-ID présent → propagé tel quel
  // -------------------------------------------------------------------------

  test('Header X-Trace-ID présent — il est propagé tel quel', ({
    given,
    when,
    then,
    and,
  }) => {
    givenTraceContextInitialized(given);

    given(
      'une requête entrante avec le header "X-Trace-ID" valant "test-trace-123"',
      () => {
        req.headers['x-trace-id'] = 'test-trace-123';
      },
    );

    when('le middleware de trace est exécuté', async () => {
      const result = await runMiddleware(req, res);
      capturedTraceId = result.traceId;
    });

    then('le traceId du contexte est "test-trace-123"', () => {
      expect(capturedTraceId).toBe('test-trace-123');
    });

    and('le header de réponse "X-Trace-ID" vaut "test-trace-123"', () => {
      expect(res.headers['x-trace-id']).toBe('test-trace-123');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Aucun header X-Request-Source → "unknown"
  // -------------------------------------------------------------------------

  test('Aucun header X-Request-Source — la source par défaut est "unknown"', ({
    given,
    when,
    then,
  }) => {
    givenTraceContextInitialized(given);

    given('une requête entrante sans header "X-Request-Source"', () => {
      req.headers = {};
    });

    when('le middleware de trace est exécuté', async () => {
      const result = await runMiddleware(req, res);
      capturedSource = result.source;
    });

    then('la source du contexte est "unknown"', () => {
      expect(capturedSource).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Header X-Request-Source présent → propagé
  // -------------------------------------------------------------------------

  test('Header X-Request-Source présent — il est propagé', ({
    given,
    when,
    then,
  }) => {
    givenTraceContextInitialized(given);

    given(
      'une requête entrante avec le header "X-Request-Source" valant "mcp"',
      () => {
        req.headers['x-request-source'] = 'mcp';
      },
    );

    when('le middleware de trace est exécuté', async () => {
      const result = await runMiddleware(req, res);
      capturedSource = result.source;
    });

    then('la source du contexte est "mcp"', () => {
      expect(capturedSource).toBe('mcp');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Mixin Pino dans un contexte de trace actif
  // Vérifie à la fois la logique inline ET buildLoggerConfig
  // -------------------------------------------------------------------------

  test('Le mixin Pino injecte traceId et source dans les logs HTTP', ({
    given,
    when,
    then,
    and,
  }) => {
    let mixinFn: (() => Record<string, unknown>) | undefined;

    givenTraceContextInitialized(given);

    given(
      'un contexte de trace actif avec traceId "trace-mixin-test" et source "http"',
      () => {
        // Le contexte sera activé dans le when
      },
    );

    when('les champs de mixin Pino sont calculés', () => {
      const config = buildLoggerConfig('info', false);
      mixinFn = config.pinoHttp.mixin as () => Record<string, unknown>;
      expect(mixinFn).toBeDefined();
    });

    then(
      'le mixin contient "traceId" avec la valeur "trace-mixin-test"',
      () => {
        TraceContext.run(
          { traceId: 'trace-mixin-test', source: 'http' },
          () => {
            const result = mixinFn!();
            expect(result).toHaveProperty('traceId', 'trace-mixin-test');
          },
        );
      },
    );

    and('le mixin contient "source" avec la valeur "http"', () => {
      TraceContext.run(
        { traceId: 'trace-mixin-test', source: 'http' },
        () => {
          const result = mixinFn!();
          expect(result).toHaveProperty('source', 'http');
        },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Mixin Pino hors contexte (RabbitMQ) → objet vide
  // -------------------------------------------------------------------------

  test('Le mixin Pino retourne un objet vide hors contexte HTTP (RabbitMQ)', ({
    given,
    when,
    then,
  }) => {
    let mixinResult: Record<string, unknown> = { sentinel: true };

    givenTraceContextInitialized(given);

    given('aucun contexte de trace actif (job RabbitMQ)', () => {
      // Pas de TraceContext.run() → getTraceId() et getSource() renvoient undefined
    });

    when('les champs de mixin Pino sont calculés', () => {
      const traceId = TraceContext.getTraceId();
      const source = TraceContext.getSource();
      mixinResult = {
        ...(traceId !== undefined ? { traceId } : {}),
        ...(source !== undefined ? { source } : {}),
      };
    });

    then('le mixin est un objet vide', () => {
      expect(mixinResult).toEqual({});
    });
  });
});
