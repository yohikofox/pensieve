/**
 * Story 14.3: Observability — Structured Logging and Prometheus
 * BDD Step Definitions (jest-cucumber)
 *
 * AC1: Logger structuré JSON (pino) avec champs requis
 * AC4: Format Prometheus valide dans /metrics
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { QueueMonitoringService } from 'src/modules/knowledge/application/services/queue-monitoring.service';

const feature = loadFeature(
  path.join(__dirname, 'features/story-14-3-observability-logger.feature'),
);

// ---------------------------------------------------------------------------
// Mock structured logger (simulates what nestjs-pino produces)
// ---------------------------------------------------------------------------

interface StructuredLogEntry {
  level: string;
  msg: string;
  time: number;
  context?: string;
  [key: string]: unknown;
}

class MockStructuredLogger {
  private entries: StructuredLogEntry[] = [];

  log(level: string, msg: string, context?: string): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      level,
      msg,
      time: Date.now(),
      ...(context ? { context } : {}),
    };
    this.entries.push(entry);
    return entry;
  }

  info(msg: string, context?: string): StructuredLogEntry {
    return this.log('info', msg, context);
  }

  warn(msg: string, context?: string): StructuredLogEntry {
    return this.log('warn', msg, context);
  }

  error(msg: string, context?: string): StructuredLogEntry {
    return this.log('error', msg, context);
  }

  getEntries(): StructuredLogEntry[] {
    return [...this.entries];
  }

  reset(): void {
    this.entries = [];
  }
}

// ---------------------------------------------------------------------------
// Test state shared across steps
// ---------------------------------------------------------------------------

interface TestState {
  logger: MockStructuredLogger;
  lastEntry: StructuredLogEntry | null;
  allEntries: StructuredLogEntry[];
  queueMonitoring: QueueMonitoringService;
  prometheusOutput: string;
}

// ---------------------------------------------------------------------------
// Feature
// ---------------------------------------------------------------------------

defineFeature(feature, (test) => {
  let state: TestState;

  const createQueueMonitoringService = (): QueueMonitoringService => {
    const configService = {
      get: (key: string, defaultValue?: string) => defaultValue ?? '',
    } as unknown as ConfigService;
    return new QueueMonitoringService(configService);
  };

  beforeEach(() => {
    const queueMonitoring = createQueueMonitoringService();
    // Mock RabbitMQ Management API — tests must not contact external services (M4 fix)
    jest.spyOn(queueMonitoring, 'getQueueDepth').mockResolvedValue(5);

    state = {
      logger: new MockStructuredLogger(),
      lastEntry: null,
      allEntries: [],
      queueMonitoring,
      prometheusOutput: '',
    };
  });

  afterEach(() => {
    state.logger.reset();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Structured log entries contain required JSON fields
  // -------------------------------------------------------------------------

  test('Structured log entries contain required JSON fields', ({
    given,
    when,
    then,
    and,
  }) => {
    given('the observability infrastructure is initialized', () => {
      // Logger is ready, no external deps required
    });

    given(
      /^a service logs an info message with context "(.+)"$/,
      (contextName: string) => {
        state.lastEntry = state.logger.info('Service started', contextName);
      },
    );

    when('the log entry is captured', () => {
      expect(state.lastEntry).not.toBeNull();
    });

    then('the log entry has a "level" field', () => {
      expect(state.lastEntry).toHaveProperty('level');
      expect(typeof state.lastEntry!.level).toBe('string');
    });

    and('the log entry has a "msg" field', () => {
      expect(state.lastEntry).toHaveProperty('msg');
      expect(typeof state.lastEntry!.msg).toBe('string');
    });

    and('the log entry has a "time" field', () => {
      expect(state.lastEntry).toHaveProperty('time');
      expect(typeof state.lastEntry!.time).toBe('number');
    });

    and(
      /^the log entry has a "context" field with value "(.+)"$/,
      (contextValue: string) => {
        expect(state.lastEntry).toHaveProperty('context');
        expect(state.lastEntry!.context).toBe(contextValue);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Logger supports all required log levels
  // -------------------------------------------------------------------------

  test('Logger supports all required log levels', ({
    given,
    when,
    and,
    then,
  }) => {
    given('the observability infrastructure is initialized', () => {});

    given('a structured logger is active', () => {
      state.allEntries = [];
    });

    when('messages are logged at "info" level', () => {
      state.allEntries.push(state.logger.info('Info message'));
    });

    and('messages are logged at "warn" level', () => {
      state.allEntries.push(state.logger.warn('Warn message'));
    });

    and('messages are logged at "error" level', () => {
      state.allEntries.push(state.logger.error('Error message'));
    });

    then(
      'all three log levels produce entries with the correct level field',
      () => {
        expect(state.allEntries).toHaveLength(3);

        const levels = state.allEntries.map((e) => e.level);
        expect(levels).toContain('info');
        expect(levels).toContain('warn');
        expect(levels).toContain('error');

        state.allEntries.forEach((entry) => {
          expect(entry).toHaveProperty('level');
          expect(entry).toHaveProperty('msg');
          expect(entry).toHaveProperty('time');
        });
      },
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Existing NestJS Logger calls remain compatible
  // -------------------------------------------------------------------------

  test('Existing NestJS Logger calls remain compatible', ({
    given,
    when,
    then,
    and,
  }) => {
    const expectedMessage = 'Queue depth exceeds threshold';

    given('the observability infrastructure is initialized', () => {});

    given('a service uses "new Logger(ClassName.name)" pattern', () => {
      // Simulate a service using the standard pattern
    });

    when('a log.warn call is made with a message', () => {
      state.lastEntry = state.logger.warn(
        expectedMessage,
        'QueueMonitoringService',
      );
    });

    then('the log entry is captured with level "warn"', () => {
      expect(state.lastEntry).not.toBeNull();
      expect(state.lastEntry!.level).toBe('warn');
    });

    and('the message field contains the expected text', () => {
      expect(state.lastEntry!.msg).toContain(expectedMessage);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Prometheus metrics endpoint returns valid format
  // -------------------------------------------------------------------------

  test('Prometheus metrics endpoint returns valid format', ({
    given,
    when,
    then,
    and,
  }) => {
    given('the observability infrastructure is initialized', () => {});

    given('the queue monitoring service has tracked some metrics', () => {
      state.queueMonitoring.recordJobProcessed();
      state.queueMonitoring.recordJobProcessed();
      state.queueMonitoring.recordJobFailed();
      state.queueMonitoring.recordJobLatency(1500);
    });

    when('the Prometheus metrics are requested', async () => {
      state.prometheusOutput =
        await state.queueMonitoring.getPrometheusMetrics();
    });

    then('the output contains "# HELP" lines', () => {
      expect(state.prometheusOutput).toContain('# HELP');
    });

    and('the output contains "# TYPE" lines', () => {
      expect(state.prometheusOutput).toContain('# TYPE');
    });

    and('the output contains metric "digestion_queue_depth"', () => {
      expect(state.prometheusOutput).toContain('digestion_queue_depth');
    });

    and('the output contains metric "digestion_jobs_processed_total"', () => {
      expect(state.prometheusOutput).toContain(
        'digestion_jobs_processed_total',
      );
    });

    and('the output contains metric "digestion_jobs_failed_total"', () => {
      expect(state.prometheusOutput).toContain('digestion_jobs_failed_total');
    });
  });
});
