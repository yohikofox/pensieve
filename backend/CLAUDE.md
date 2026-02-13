# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev                  # Dev server (watch mode, port 3000)
npm run build                      # Production build (nest build)
npm run lint                       # ESLint with auto-fix
npm run format                     # Prettier
npm run test                       # Unit tests (src/**/*.spec.ts)
npm run test:watch                 # Unit tests watch mode
npm run test:cov                   # Coverage report
npm run test:e2e                   # E2E tests (test/**/*.e2e-spec.ts)
npm run test:acceptance            # BDD/Gherkin tests (test/acceptance/**/*.test.ts)
npm run test:acceptance:story-4-1  # Single story acceptance test
npm run migration:run              # Run TypeORM migrations
npm run seed:authorization         # Seed roles, permissions, tiers
npm run migrate:users              # Migrate existing users
```

### Running a single test

```bash
npx jest src/path/to/file.spec.ts                                              # Unit test
npx jest --config ./test/jest-e2e.json test/path/to/file.e2e-spec.ts           # E2E test
npx jest --config ./test/jest-acceptance.json test/acceptance/story-4-1.test.ts # Acceptance test
```

## Architecture

NestJS 11 hybrid app: HTTP server + RabbitMQ microservice consumer, bootstrapped in `src/main.ts` via `connectMicroservice()` + `startAllMicroservices()`.

### DDD Bounded Contexts (`src/modules/`)

Each module follows the same layered structure: `domain/entities/`, `domain/events/`, `application/services/`, `application/repositories/`, `application/controllers/`, `infrastructure/`.

| Module | Purpose |
|--------|---------|
| **shared** | `@Global()` module. MinioService (S3 storage), SupabaseAuthGuard (JWT validation), User entity |
| **identity** | Supabase OAuth callbacks (Google, HuggingFace), mobile deep linking |
| **authorization** | Multi-level permission system (RBAC + PBAC + ACL) with swappable implementations |
| **knowledge** | AI digestion pipeline: RabbitMQ job queue, OpenAI GPT-4o-mini, WebSocket progress, Thought/Idea entities |
| **action** | Todo extraction from thoughts: deadline parsing (chrono-node), priority inference |
| **notification** | Push notifications, digestion progress tracking, event-driven listeners |
| **rgpd** | GDPR compliance: data export, account deletion |

### Authorization System

Uses DI string tokens for swappable implementations (currently PostgreSQL, designed for future Supabase RLS swap):
- `'IAuthorizationService'` - Main authorization orchestrator
- `'IPermissionChecker'` - Multi-source permission resolution
- `'IResourceAccessControl'` - Resource sharing and ACL

**Permission resolution order** (highest priority first): user override → resource share → subscription tier → role-based.

**Guards and decorators**: `@RequirePermission()`, `@RequireOwnership()`, `@AllowSharedAccess()`, `@CurrentUser()` — applied at controller method level via `PermissionGuard`, `ResourceOwnershipGuard`, `ResourceShareGuard`.

Implementation in `src/modules/authorization/implementations/postgresql/` with 11 entities modeling the complete RBAC/PBAC/ACL schema.

### Knowledge Pipeline (RabbitMQ)

Config centralized in `src/modules/knowledge/infrastructure/rabbitmq/rabbitmq.config.ts`. Queue is durable with dead-letter exchange and priority support (max 10). Consumer prefetch = 3, timeout = 60s.

**Flow**: Controller → `DigestionJobPublisher` → RabbitMQ → `DigestionJobConsumer` → `OpenAIService` (GPT-4o-mini + tiktoken chunking) → persist Thought/Ideas → WebSocket notification via `KnowledgeEventsGateway`.

### Database

TypeORM with PostgreSQL. `synchronize: false` — all schema changes via migrations in `src/migrations/`. Entities are auto-loaded (`autoLoadEntities: true`). Connection via `DATABASE_URL` env var.

5 migrations covering: thoughts/ideas tables, todos, notifications, user notification preferences, authorization tables (11 tables with composite indexes).

### Test Infrastructure

- **Unit tests**: `src/**/*.spec.ts`, config in `package.json` jest section
- **E2E tests**: `test/**/*.e2e-spec.ts`, config in `test/jest-e2e.json`
- **Acceptance tests**: `test/acceptance/**/*.test.ts`, config in `test/jest-acceptance.json` (10s timeout, `src/` path alias via moduleNameMapper)

BDD uses `jest-cucumber`. Features in `.feature` files, step definitions in `.test.ts`. Test mocks in `test/acceptance/support/test-context.ts` (in-memory RabbitMQ, capture repository, progress tracker).

## Code Style

- TypeScript strict mode, ES2023 target, `nodenext` module resolution
- ESLint 9 flat config (`eslint.config.mjs`) + Prettier (single quotes, trailing commas)
- Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.)

## External Services

Supabase (auth/JWT), PostgreSQL, RabbitMQ, MinIO (S3-compatible storage), OpenAI (GPT-4o-mini), Redis (optional, for progress store).
