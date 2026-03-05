/**
 * BDD Acceptance Tests — Story 16.1: Verrouillage des actions et feedback visuel
 *
 * Valide :
 * - AC1/AC2/AC6: isProcessing verrouille les actions quand state === 'processing' ou isInQueue === true
 * - AC5: Retry autorisé uniquement quand state === 'failed' (isProcessing retourne false)
 * - Matrice d'états: cohérence du guard sur tous les états possibles
 *
 * Strategy: tests au niveau du guard métier (isProcessing helper)
 * Le comportement UI (opacité, swipe) est délégué aux composants React testés manuellement.
 */

import 'reflect-metadata';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { isProcessing } from '../../src/contexts/capture/utils/capture.guards';
import type { CaptureState } from '../../src/contexts/capture/domain/Capture.model';

const feature = loadFeature(
  'tests/acceptance/features/story-16-1-capture-processing-guards.feature',
);

type CaptureWithOptionalQueue = { state: CaptureState; isInQueue?: boolean };

defineFeature(feature, (test) => {
  let capture: CaptureWithOptionalQueue;
  let result: boolean;

  // ── Scenario 1: state === 'processing' ───────────────────────────────────────

  test('Capture en état processing — isProcessing retourne true', ({
    given,
    when,
    then,
    and,
  }) => {
    given('une capture avec l\'état "processing" et isInQueue à false', () => {
      capture = { state: 'processing', isInQueue: false };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est true', () => {
      expect(result).toBe(true);
    });

    and('toutes les actions (sauf lecture) doivent être verrouillées', () => {
      // Le guard est la source de vérité — si isProcessing === true, les composants
      // UI appliquent le verrouillage (opacité, disabled, swipe désactivé)
      expect(result).toBe(true);
    });
  });

  // ── Scenario 2: isInQueue === true ───────────────────────────────────────────

  test('Capture en file d\'attente — isProcessing retourne true', ({
    given,
    when,
    then,
    and,
  }) => {
    given('une capture avec l\'état "captured" et isInQueue à true', () => {
      capture = { state: 'captured', isInQueue: true };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est true', () => {
      expect(result).toBe(true);
    });

    and('toutes les actions (sauf lecture) doivent être verrouillées', () => {
      expect(result).toBe(true);
    });
  });

  // ── Scenario 3: state === 'captured', pas en queue ───────────────────────────

  test('Capture en état captured sans queue — isProcessing retourne false', ({
    given,
    when,
    then,
    and,
  }) => {
    given('une capture avec l\'état "captured" et isInQueue à false', () => {
      capture = { state: 'captured', isInQueue: false };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est false', () => {
      expect(result).toBe(false);
    });

    and('la transcription est autorisée', () => {
      // state === 'captured' && !isProcessing → bouton Transcrire visible
      expect(result).toBe(false);
    });
  });

  // ── Scenario 4: state === 'ready' ────────────────────────────────────────────

  test('Capture en état ready — isProcessing retourne false', ({
    given,
    when,
    then,
  }) => {
    given('une capture avec l\'état "ready" et isInQueue à false', () => {
      capture = { state: 'ready', isInQueue: false };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est false', () => {
      expect(result).toBe(false);
    });
  });

  // ── Scenario 5: state === 'failed' — retry autorisé ─────────────────────────

  test('Capture en état failed — isProcessing retourne false (retry autorisé)', ({
    given,
    when,
    then,
    and,
  }) => {
    given('une capture avec l\'état "failed" et isInQueue à false', () => {
      capture = { state: 'failed', isInQueue: false };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est false', () => {
      expect(result).toBe(false);
    });

    and('le retry est autorisé (état failed)', () => {
      // state === 'failed' && !isProcessing → bouton Retry actif (AC5)
      expect(result).toBe(false);
    });
  });

  // ── Scenario 6: state === 'processing' ET isInQueue ──────────────────────────

  test('Capture en état processing ET isInQueue — isProcessing retourne true', ({
    given,
    when,
    then,
  }) => {
    given('une capture avec l\'état "processing" et isInQueue à true', () => {
      capture = { state: 'processing', isInQueue: true };
    });

    when('on évalue isProcessing pour cette capture', () => {
      result = isProcessing(capture);
    });

    then('le résultat est true', () => {
      expect(result).toBe(true);
    });
  });

  // ── Scenario 7: Matrice complète ─────────────────────────────────────────────

  test('Seul l\'état processing et isInQueue === true verrouillent les actions', ({
    given,
    when,
    then,
    and,
  }) => {
    const states: CaptureState[] = ['captured', 'processing', 'ready', 'failed'];
    const results: Record<CaptureState, boolean> = {} as Record<CaptureState, boolean>;

    given('les états de capture possibles sont "captured", "processing", "ready", "failed"', () => {
      // États définis ci-dessus
    });

    when('on évalue isProcessing pour chaque état sans file d\'attente', () => {
      for (const state of states) {
        results[state] = isProcessing({ state, isInQueue: false });
      }
    });

    then('seul l\'état "processing" retourne true', () => {
      expect(results['processing']).toBe(true);
    });

    and('les états "captured", "ready", "failed" retournent false', () => {
      expect(results['captured']).toBe(false);
      expect(results['ready']).toBe(false);
      expect(results['failed']).toBe(false);
    });
  });
});
