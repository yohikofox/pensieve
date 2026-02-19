# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start                    # Expo dev client
npm run ios                      # iOS simulator (dev variant)
npm run android                  # Android emulator (dev variant)
npm run prebuild:clean           # Clean + regenerate native projects

npm run test                     # All tests
npm run test:unit                # Unit tests only (src/**/*.test.ts)
npm run test:acceptance          # BDD/Gherkin tests
npm run test:acceptance:watch    # BDD watch mode
npm run test:e2e                 # Detox E2E (iOS)

# Single test file
npx jest src/path/to/file.test.ts
npx jest --config jest.config.acceptance.js tests/acceptance/story-2-1-simple.test.ts
```

## Architecture

### DDD Bounded Contexts

Each context in `src/contexts/` mirrors the backend and follows hexagonal architecture:

```
contexts/[context-name]/
├── domain/      # Interfaces, models, value objects (pure, no dependencies)
├── data/        # Repository implementations
├── services/    # Application services (business logic)
├── hooks/       # React hooks for this context
└── ui/          # Context-specific components
```

Contexts: `capture/`, `knowledge/`, `action/`, `identity/`, `Normalization/` (transcription), `shared/` (EventBus), `theme/`.

### Bootstrap Sequence

```
index.ts → bootstrap() → App.tsx → MainApp.tsx
```

DI container (`src/infrastructure/di/container.ts`) is registered **before** React renders. All services must be registered during bootstrap, not at import time.

### Dependency Injection (tsyringe)

Symbol-based tokens defined in `src/infrastructure/di/tokens.ts`. Services registered as singletons in `container.ts`.

**Critical pattern — lazy resolution in React:**
```typescript
// ❌ WRONG: module-level resolution fails before bootstrap
const log = container.resolve<ILogger>(TOKENS.ILogger);

// ✅ CORRECT: resolve lazily inside hooks/effects
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger);
```

### State Management

- **Zustand** (`src/stores/`) — client state, event-driven via EventBus (no polling)
- **React Query** — server state (API data)
- **OP-SQLite** (`src/database/`) — local persistence with synchronous queries and migration system

### Navigation

React Navigation v7 with bottom tabs + stack navigators. Configuration centralized in **Screen Registry** (`src/screens/registry.ts`): each screen declares its icon, i18n keys, and nav options in one place.

### Screen Pattern

Complex screens use **Wrapper + Content** separation:
```
ScreenWrapper (small) — extracts route params only
  └─ ScreenContent (large) — all business logic, testable without navigation
```

### Styling

NativeWind (Tailwind for RN) with design system tokens in `src/design-system/`.

## Testing

Three tiers: Unit (babel-jest) → BDD/Gherkin (ts-jest + jest-cucumber) → E2E (Detox).

**Jest uses `babel-jest`, NOT `jest-expo`** — due to Expo SDK 54 Winter runtime incompatibility with Node.js test environment. Acceptance tests use `ts-jest`.

BDD test infrastructure:
- Features: `tests/acceptance/features/*.feature`
- Step definitions: `tests/acceptance/story-*.test.ts`
- In-memory mocks: `tests/acceptance/support/test-context.ts`

## Key Files

| Purpose              | File                                                                   |
|----------------------|------------------------------------------------------------------------|
| DI container         | `src/infrastructure/di/container.ts`                                   |
| DI tokens            | `src/infrastructure/di/tokens.ts`                                      |
| App bootstrap        | `src/config/bootstrap.ts`                                              |
| Screen registry      | `src/screens/registry.ts`                                              |
| Database setup       | `src/database/index.ts`                                                |
| Babel config         | `babel.config.js` (decorator + metadata plugins required for tsyringe) |
| Expo config          | `app.config.js` (dev/release variants, New Architecture enabled)       |
| Patches              | `patches/` (patch-package, applied via postinstall)                    |
| Custom native module | `modules/expo-waveform-extractor/`                                     |

## Snippets and patterns

You can find in _patterns folder several files that explains how to implement many components in the project.

## Architecture Tests

Please keep architecture tests valid during development phase

You can execute them with following command: 

```shell
npm run test:architecture
```