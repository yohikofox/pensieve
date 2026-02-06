# Logger Service

Production-ready logging service with IoC/DI support.

## Architecture

- **Interface**: `ILogger` - Injectable interface for dependency injection
- **Implementation**: `LoggerService` - Default console-based implementation
- **Token**: `TOKENS.ILogger` - DI container token

## Log Levels

| Level | Development | Production | Usage |
|-------|-------------|------------|-------|
| `debug` | ✅ Enabled | ❌ No-op | Detailed debugging information |
| `info` | ✅ Enabled | ❌ No-op | General informational messages |
| `warn` | ✅ Enabled | ✅ Enabled | Non-critical issues |
| `error` | ✅ Enabled | ✅ Enabled | Errors and exceptions |

## Usage

### In App.tsx or top-level components

```typescript
import { container } from 'tsyringe';
import { TOKENS } from './infrastructure/di/tokens';
import type { ILogger } from './infrastructure/logging/ILogger';

// Resolve and create scoped logger
const log = container.resolve<ILogger>(TOKENS.ILogger).createScope('App');

log.debug('App initialized');        // Only in dev
log.info('User logged in');          // Only in dev
log.warn('Deprecated API used');     // Always
log.error('Failed to load', error);  // Always
```

### In injectable services (Recommended)

```typescript
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ILogger } from '../../infrastructure/logging/ILogger';

@injectable()
export class MyService {
  private log: ILogger;

  constructor(
    @inject(TOKENS.ILogger) logger: ILogger
  ) {
    // Create scoped logger with service name
    this.log = logger.createScope('MyService');
  }

  async doSomething() {
    this.log.debug('Starting operation...');

    try {
      // ... operation ...
      this.log.info('Operation completed');
    } catch (error) {
      this.log.error('Operation failed:', error);
      throw error;
    }
  }
}
```

### Nested scopes

```typescript
@injectable()
export class UserService {
  private log: ILogger;

  constructor(@inject(TOKENS.ILogger) logger: ILogger) {
    this.log = logger.createScope('UserService');
  }

  async login(email: string) {
    const loginLog = this.log.createScope('login');
    loginLog.debug('Attempting login for:', email);
    // Output: [UserService:login] Attempting login for: ...
  }
}
```

## Testing

Mock the logger in tests:

```typescript
import { container } from 'tsyringe';
import { TOKENS } from '../infrastructure/di/tokens';
import type { ILogger } from '../infrastructure/logging/ILogger';

const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  createScope: jest.fn(() => mockLogger),
};

container.registerInstance(TOKENS.ILogger, mockLogger);
```

## Extending the Logger

To add features like remote logging or timestamps:

```typescript
@injectable()
export class RemoteLoggerService implements ILogger {
  constructor(
    @inject(TOKENS.ILogger) private baseLogger: ILogger,
    @inject(RemoteLoggingService) private remote: RemoteLoggingService
  ) {}

  debug(...args: any[]) {
    this.baseLogger.debug(...args);
  }

  error(...args: any[]) {
    this.baseLogger.error(...args);
    // Send to remote service in production
    if (!__DEV__) {
      this.remote.send('error', args);
    }
  }

  // ... other methods
}
```

## Migration from console.*

Before:
```typescript
console.debug('Debug message');
console.error('Error:', error);
```

After:
```typescript
// In App.tsx or top-level
const log = container.resolve<ILogger>(TOKENS.ILogger).createScope('App');
log.debug('Debug message');
log.error('Error:', error);

// In injectable service
@injectable()
export class MyService {
  constructor(@inject(TOKENS.ILogger) logger: ILogger) {
    this.log = logger.createScope('MyService');
  }
}
```

## Benefits

- ✅ **Testable** - Easy to mock in unit tests
- ✅ **Consistent** - Follows project's IoC/DI architecture (ADR-017)
- ✅ **Production-ready** - Automatically strips debug logs in production
- ✅ **Extensible** - Can add remote logging, timestamps, etc.
- ✅ **Scoped** - Clear log prefixes show which service logged
- ✅ **Type-safe** - Full TypeScript support
