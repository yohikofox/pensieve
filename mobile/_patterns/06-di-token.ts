/**
 * PATTERN: Définition de Token DI (ADR-017)
 *
 * Source: src/infrastructure/di/tokens.ts
 *
 * RÈGLES:
 * - Tous les tokens dans TOKENS (un seul objet centralisé)
 * - Format : Symbol.for('INomInterface') — le "I" est obligatoire pour les interfaces
 * - Ajouter le token ET l'enregistrer dans container.ts dans la même PR
 * - Les classes concrètes sans interface n'ont pas besoin de token (injecter la classe directement)
 *
 * QUAND utiliser un token (Symbol) vs injecter la classe directement :
 *   - Token : quand il existe une interface (ICaptureRepository, ILogger...)
 *   - Classe directe : quand on injecte la concrète (WaveformExtractionService, SyncTrigger...)
 */

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Ajouter un token dans tokens.ts
// ─────────────────────────────────────────────────────────────────────────────

export const TOKENS = {
  // ← Copier la structure existante, ajouter à la bonne section

  // Infrastructure Services
  ILogger: Symbol.for('ILogger'),

  // Domain Repositories — nommer avec le contexte en préfixe
  ICaptureRepository: Symbol.for('ICaptureRepository'),
  IExampleRepository: Symbol.for('IExampleRepository'), // ← nouveau token

  // Application Services
  IExampleService: Symbol.for('IExampleService'), // ← nouveau token

  // Hardware/Platform Adapters
  IAudioRecorder: Symbol.for('IAudioRecorder'),
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Utiliser le token dans @inject
// ─────────────────────────────────────────────────────────────────────────────

import { injectable, inject } from 'tsyringe';

interface IExampleService {
  doSomething(): void;
}

@injectable()
class ExampleConsumer {
  constructor(
    // Avec token (interface)
    @inject(TOKENS.IExampleRepository) private repo: unknown,
    // Sans token (classe concrète)
    @inject('EventBus') private eventBus: unknown,
  ) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : Token défini en dehors de TOKENS
// ─────────────────────────────────────────────────────────────────────────────

// ❌ JAMAIS ça — token "orphelin" non centralisé
// const MY_TOKEN = Symbol.for('IMyService');

// ❌ JAMAIS ça — string token (pas type-safe)
// @inject('IMyService')
