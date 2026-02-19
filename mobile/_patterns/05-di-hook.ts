/**
 * PATTERN: Résolution DI dans React — Lazy Resolution (ADR-017)
 *
 * Source: src/contexts/capture/hooks/useWaveformService.ts
 *
 * RÈGLE CRITIQUE : Ne JAMAIS résoudre un service au niveau du module.
 * Le container doit être initialisé AVANT React (dans bootstrap.ts).
 * La résolution se fait TOUJOURS dans un hook ou un effect, jamais à l'import.
 *
 * Utiliser useRef pour conserver la même instance entre les re-renders.
 */

import { useRef } from 'react';
import { container } from '../src/infrastructure/di/container';
import { TOKENS } from '../src/infrastructure/di/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Résolution lazy avec useRef (instance stable)
// ─────────────────────────────────────────────────────────────────────────────

class ExampleService {
  doSomething() { return 'done'; }
}

export function useExampleService(): ExampleService {
  const serviceRef = useRef<ExampleService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = container.resolve(ExampleService);
  }

  return serviceRef.current;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Résolution avec token (interface)
// ─────────────────────────────────────────────────────────────────────────────

interface ICaptureRepository {
  findAll(): Promise<unknown[]>;
}

export function useCaptureRepository(): ICaptureRepository {
  const repoRef = useRef<ICaptureRepository | null>(null);

  if (!repoRef.current) {
    repoRef.current = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
  }

  return repoRef.current;
}

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : Résolution au niveau module (avant bootstrap)
// ─────────────────────────────────────────────────────────────────────────────

// ❌ JAMAIS ça — le container n'est pas encore initialisé à l'import
// const service = container.resolve(ExampleService);

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : Résolution dans le corps du composant sans useRef
// ─────────────────────────────────────────────────────────────────────────────

// ❌ JAMAIS ça — crée une nouvelle instance à chaque render
// function MyComponent() {
//   const service = container.resolve(ExampleService); // ← nouvelle instance à chaque render
// }
