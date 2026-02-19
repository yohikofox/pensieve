/**
 * Logger NestJS Integration Tests
 * Story 14.3 — AC1: Logger structuré NestJS (pino)
 *
 * Vérifie que nestjs-pino est correctement intégré dans un TestingModule NestJS.
 * Contrairement aux unit tests de logger.config.spec.ts (qui testent la config),
 * ces tests valident que Logger de nestjs-pino est instanciable et fonctionnel
 * dans un vrai contexte NestJS.
 *
 * Fix H2: Les tests BDD utilisent MockStructuredLogger (stub). Ces tests prouvent
 * que l'intégration NestJS réelle avec nestjs-pino est opérationnelle.
 */

import { Test } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig } from './logger.config';

describe('Logger NestJS Integration (AC1 — Story 14.3)', () => {
  it('should create a NestJS TestingModule with LoggerModule using buildLoggerConfig', async () => {
    const config = buildLoggerConfig('info', false);
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(config)],
    }).compile();

    const logger = module.get(Logger);
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.verbose).toBe('function');

    await module.close();
  });

  it('should create LoggerModule with pretty-print config (development mode)', async () => {
    const config = buildLoggerConfig('debug', true);
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(config)],
    }).compile();

    const logger = module.get(Logger);
    expect(logger).toBeDefined();

    await module.close();
  });

  it('should create LoggerModule with custom log level', async () => {
    const config = buildLoggerConfig('warn', false);
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(config)],
    }).compile();

    const logger = module.get(Logger);
    expect(logger).toBeDefined();

    await module.close();
  });

  it('should create LoggerModule with file transport (production + logFilePath)', async () => {
    const config = buildLoggerConfig('info', false, '/tmp/pensine-test.log');
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(config)],
    }).compile();

    const logger = module.get(Logger);
    expect(logger).toBeDefined();

    await module.close();
  });
});
