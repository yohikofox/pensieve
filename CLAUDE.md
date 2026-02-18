# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pensieve is a hybrid mobile-first app (Supabase Cloud Auth + Homelab backend) for audio capture, AI digestion, and knowledge management. Monorepo with three independent packages (no shared workspaces): `mobile/`, `backend/`, `web/`.

**Tech stack**: Node 22 (.nvmrc), Expo SDK 54, NestJS 11, Next.js 15, TypeScript strict mode everywhere.

## Commands

### Backend (`cd backend`)

```bash
npm run start:dev                  # Dev server (watch mode, port 3000)
npm run build                      # Production build
npm run lint                       # ESLint (auto-fix)
npm run format                     # Prettier
npm run test                       # Unit tests (*.spec.ts in src/)
npm run test:watch                 # Unit tests watch mode
npm run test:cov                   # Coverage
npm run test:e2e                   # E2E tests (test/jest-e2e.json)
npm run test:acceptance            # BDD/Gherkin tests (test/jest-acceptance.json)
npm run test:acceptance:story-4-1  # Single story acceptance test
npm run migration:run              # Run TypeORM migrations
npm run seed:authorization         # Seed authorization data
```

Unit tests match `*.spec.ts` in `src/`. Acceptance tests match `*.test.ts` in `test/acceptance/`.

### Mobile (`cd mobile`)

```bash
npm run start                       # Expo dev client
npm run ios                         # iOS simulator (dev variant)
npm run android                     # Android emulator (dev variant)
npm run prebuild                    # Generate native projects
npm run prebuild:clean              # Clean + regenerate native projects
npm run test                        # All tests
npm run test:unit                   # Unit tests only (src/**/*.test.ts)
npm run test:acceptance             # BDD/Gherkin tests (jest.config.acceptance.js)
npm run test:acceptance:watch       # BDD watch mode
npm run test:acceptance:story-2-1   # Single story acceptance test
npm run test:e2e                    # Detox E2E (iOS)
```

Jest uses `babel-jest` (not jest-expo) due to Expo SDK 54 Winter runtime incompatibility with Node.js test environment. Acceptance tests use `ts-jest`.

### Web (`cd web`)

```bash
npm run dev     # Next.js dev server
npm run build   # Production build
npm run lint    # ESLint
```

### Infrastructure (`cd infrastructure`)

```bash
docker-compose up -d    # Start PostgreSQL, RabbitMQ, MinIO
docker-compose down     # Stop services
```

### Docker builds (root Makefile)

```bash
make build-backend   # Build backend Docker image
make build-web       # Build web Docker image
make release         # Build + push all to registry
```

## Architecture

### Backend (NestJS DDD)

Each NestJS module is a **DDD Bounded Context** with layers: `domain/entities/`, `application/services/`, `application/repositories/`, `application/controllers/`, `infrastructure/`.

Modules in `backend/src/modules/`:
- **shared** - Global (`@Global()`) providers: MinioService, SupabaseAuthGuard
- **identity** - Supabase JWT authentication
- **authorization** - Multi-level permissions (RBAC/PBAC/ACL) with swappable implementation via DI tokens (`'IAuthorizationService'`, `'IPermissionChecker'`, `'IResourceAccessControl'`)
- **knowledge** - AI digestion pipeline: RabbitMQ jobs, OpenAI GPT-4o-mini, WebSocket progress notifications
- **action** - Todos extraction with deadline parsing and priority inference
- **notification** - Push notifications
- **rgpd** - GDPR compliance (export/delete)

**Hybrid app**: HTTP + RabbitMQ microservice (`main.ts` calls `connectMicroservice` + `startAllMicroservices`).

**Database**: TypeORM with PostgreSQL. `synchronize: false` - schema changes via migrations only (`src/migrations/`).

### Mobile (React Native + Expo)

- **DI**: tsyringe with decorator-based injection (`src/infrastructure/di/`)
- **State**: Zustand for global state, React Query for server state
- **Local DB**: `@op-engineering/op-sqlite` (offline-first, synchronous queries)
- **Contexts** in `src/contexts/`: capture, knowledge, action, identity, shared (mirrors backend DDD)
- **Navigation**: React Navigation (bottom tabs + native stack)
- **i18n**: i18next
- **AI on-device**: whisper.rn (speech-to-text), llama.rn, expo-llm-mediapipe
- **Custom native module**: `modules/expo-waveform-extractor/` (local file: dependency)

### Web (Next.js 15)

Minimal dashboard. App Router, Tailwind CSS, standalone Docker deployment.

## Testing

### BDD/Gherkin Pattern (both backend & mobile)

Uses `jest-cucumber`. Features in `*.feature` files, step definitions in `*.test.ts`.

**Mobile test structure**:
- `tests/acceptance/features/` - Gherkin .feature files
- `tests/acceptance/support/test-context.ts` - 12 in-memory mocks (Supabase, OP-SQLite, API)
- `tests/acceptance/story-*.test.ts` - Step definitions

**Backend test structure**:
- `test/acceptance/features/` - Gherkin .feature files
- `test/acceptance/story-*.test.ts` - Step definitions

### Running a single test file

```bash
# Backend
cd backend && npx jest src/path/to/file.spec.ts
cd backend && npx jest --config ./test/jest-acceptance.json test/acceptance/story-4-1.test.ts

# Mobile
cd mobile && npx jest src/path/to/file.test.ts
cd mobile && npx jest --config jest.config.acceptance.js tests/acceptance/story-2-1-simple.test.ts
```

## ⛔ Gouvernance Architecturale — Règles Absolues pour l'Agent Dev

Ces règles sont non négociables. Elles ont été établies suite à une substitution unilatérale de librairie non autorisée (story 14.3, Pino vs Winston).

### Interdictions strictes

- **JAMAIS remplacer une librairie prescrite dans un ADR** sans mandat explicite de l'architecte (Winston)
- **JAMAIS reporter un Acceptance Criterion** d'une story sans en informer l'architecte et documenter la raison comme un point en attente de validation, pas comme une "décision"
- **JAMAIS introduire une dépendance structurante** (nouvelle librairie, nouveau pattern d'infrastructure) sans qu'elle soit référencée dans un ADR ou une story

### Procédure si divergence identifiée

Si un ADR prescrit X mais que Y semble techniquement supérieur :

1. **SIGNALER** la divergence explicitement dans la story en cours (section "Blockers / Questions architecturales")
2. **NE PAS implémenter** la substitution de manière autonome
3. **ATTENDRE** validation de l'architecte avant de procéder

La conformité aux ADRs prime sur l'optimisation technique unilatérale.

---

## Code Style

- **Backend**: ESLint 9 flat config + Prettier (single quotes, trailing commas). Source in CommonJS module style (NestJS convention).
- **Mobile**: Babel with decorator support (`@babel/plugin-proposal-decorators`, `babel-plugin-transform-typescript-metadata`).
- **Commit convention**: Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.)

## Key Env Files

Each package has a `.env.example` template. Key services: Supabase (auth), PostgreSQL, RabbitMQ, MinIO (S3-compatible storage), OpenAI.
