/**
 * PATTERN: Enregistrement DI — TSyringe (ADR-021)
 *
 * Source: src/infrastructure/di/container.ts
 *
 * RÈGLE FONDAMENTALE (ADR-021) : TRANSIENT FIRST
 * Par défaut : container.register() → transient (nouvelle instance à chaque résolution)
 * Singleton : registerSingleton() → SEULEMENT si justification explicite
 *
 * QUAND utiliser Singleton :
 *   - Hardware/Platform adapters (coût d'initialisation natif élevé)
 *   - Services avec état partagé en session (queue, session auth, cache device)
 *   - Modèles AI chargés en mémoire (Whisper, LLM)
 *   - Bus/infrastructure partagés entre tous les contextes (EventBus)
 *
 * QUAND utiliser Transient (par défaut) :
 *   - Repositories (stateless, accès DB sans état mutable)
 *   - Services applicatifs sans état partagé
 *   - Adapters stateless
 */

import { container } from 'tsyringe';
import { TOKENS } from '../src/infrastructure/di/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ TRANSIENT : Service stateless (défaut)
// ─────────────────────────────────────────────────────────────────────────────

class ExampleRepository {}
class ExampleService {}

// Avec token (quand il y a une interface)
container.register(TOKENS.ICaptureRepository, { useClass: ExampleRepository });

// Sans token (quand la classe concrete est injectée directement)
container.register(ExampleService, { useClass: ExampleService });

// ─────────────────────────────────────────────────────────────────────────────
// ✅ SINGLETON : Service avec état justifié
// ─────────────────────────────────────────────────────────────────────────────

class ExampleModelService {}
class ExampleHardwareAdapter {}

// SINGLETON: ExampleModelService — modèle chargé en mémoire, coût d'initialisation élevé (ADR-021)
container.registerSingleton(ExampleModelService);

// SINGLETON: ExampleHardwareAdapter — hardware natif, coût d'initialisation (ADR-021 exception)
container.registerSingleton(TOKENS.IAudioRecorder, ExampleHardwareAdapter);

// ─────────────────────────────────────────────────────────────────────────────
// ✅ INSTANCE : Pour les objets déjà construits (EventBus, instances configurées)
// ─────────────────────────────────────────────────────────────────────────────

import { eventBus } from '../src/contexts/shared/events/EventBus';

// SINGLETON: EventBus instance — bus partagé entre tous les contextes (ADR-021)
container.registerInstance('EventBus', eventBus);

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FACTORY : Pour les services qui nécessitent une configuration runtime
// ─────────────────────────────────────────────────────────────────────────────

class ExampleApiService {
  constructor(private apiUrl: string) {}
}

container.register(ExampleApiService, {
  useFactory: () => {
    const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    return new ExampleApiService(url);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : Singleton sans justification
// ─────────────────────────────────────────────────────────────────────────────

class StatelessProcessor {}

// ❌ JAMAIS ça pour un service stateless
// container.registerSingleton(StatelessProcessor);

// ✅ À la place
container.register(StatelessProcessor, { useClass: StatelessProcessor });
