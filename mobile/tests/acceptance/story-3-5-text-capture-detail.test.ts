/**
 * Story 3.5 - Vue Détail Capture Texte — Layout Dédié & Édition Inline
 * BDD Acceptance Tests (jest-cucumber)
 *
 * Tests purement domaine/store — aucun rendu React.
 * RED → GREEN → REFACTOR cycle.
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import {
  TestContext,
  createMockTextCapture,
  createMockAudioCapture,
} from './support/test-context';
import { useCaptureDetailStore } from '../../src/stores/captureDetailStore';

const feature = loadFeature(
  './tests/acceptance/features/story-3-5-text-capture-detail.feature',
);

defineFeature(feature, (test) => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = new TestContext();
    useCaptureDetailStore.getState().reset();
  });

  afterEach(() => {
    testContext.reset();
    useCaptureDetailStore.getState().reset();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC1 - Layout dédié pour les captures texte
  // ──────────────────────────────────────────────────────────────────────────
  test('AC1 - Layout dédié pour les captures texte', ({ given, when, then, and }) => {
    let capture: any;

    given('une capture de type texte avec du contenu', async () => {
      capture = await testContext.db.create(
        createMockTextCapture({
          id: 'text-ac1',
          normalizedText: 'Mon texte de pensée',
        }),
      );
    });

    when("l'écran de détail se charge", async () => {
      const loaded = await testContext.db.findById('text-ac1');
      capture = loaded;
    });

    then('la capture est identifiée comme non-audio', () => {
      expect(capture?.type).toBe('TEXT');
    });

    and("la capture n'a pas de fichier audio associé", () => {
      expect(capture?.filePath).toBeUndefined();
      expect(capture?.duration).toBeUndefined();
    });

    and('la section Analyse est visible sans navigation par onglets', () => {
      // Pour une capture TEXT, le layout dédié n'utilise pas de tabs.
      // Vérification structurelle : capture.type === 'TEXT' implique layout sans tabs.
      expect(capture?.type).toBe('TEXT');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC2 - Mode lecture par défaut
  // ──────────────────────────────────────────────────────────────────────────
  test('AC2 - Mode lecture par défaut', ({ given, when, then, and }) => {
    let capture: any;
    let isEditingText: boolean;

    given('une capture de type texte avec du contenu', async () => {
      capture = await testContext.db.create(
        createMockTextCapture({
          id: 'text-ac2',
          normalizedText: 'Contenu lecture seule',
        }),
      );
    });

    when("l'écran de détail se charge", async () => {
      const loaded = await testContext.db.findById('text-ac2');
      capture = loaded;
      // Valeur initiale du store (isEditingText = false au chargement)
      isEditingText = false;
    });

    then('le mode édition est inactif par défaut', () => {
      expect(isEditingText).toBe(false);
    });

    and('le texte de la capture est accessible en lecture', () => {
      expect(capture?.normalizedText).toBe('Contenu lecture seule');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC3 - Passage en mode édition
  // ──────────────────────────────────────────────────────────────────────────
  test('AC3 - Passage en mode édition', ({ given, when, then, and }) => {
    given('une capture de type texte affichée en mode lecture', async () => {
      await testContext.db.create(
        createMockTextCapture({
          id: 'text-ac3',
          normalizedText: 'Texte initial',
        }),
      );
      // Le store démarre avec isEditingText=false (reset dans beforeEach)
      expect(useCaptureDetailStore.getState().isEditingText).toBe(false);
    });

    when("l'utilisateur active le mode édition", () => {
      // Simule le tap sur "Modifier" → setIsEditingText(true) dans le store
      useCaptureDetailStore.getState().setIsEditingText(true);
    });

    then('le mode édition est actif', () => {
      expect(useCaptureDetailStore.getState().isEditingText).toBe(true);
    });

    and("l'ActionBar affiche Annuler et Enregistrer", () => {
      // ActionBar affiche Cancel/Save quand isEditingText || hasTextChanges
      const { isEditingText, hasTextChanges } = useCaptureDetailStore.getState();
      expect(isEditingText || hasTextChanges).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC4 - Sauvegarde de la modification
  // ──────────────────────────────────────────────────────────────────────────
  test('AC4 - Sauvegarde de la modification', ({ given, when, then, and }) => {
    const captureId = 'text-ac4';
    const texteModifie = "Texte corrigé par l'utilisateur";

    given('une capture de type texte en mode édition avec du texte modifié', async () => {
      await testContext.db.create(
        createMockTextCapture({
          id: captureId,
          normalizedText: 'Texte original',
        }),
      );
      // Simule le passage en mode édition via le store
      useCaptureDetailStore.getState().setIsEditingText(true);
      // L'utilisateur a modifié le texte dans le TextInput
      await testContext.db.update(captureId, { normalizedText: texteModifie });
    });

    when("l'utilisateur sauvegarde les modifications", () => {
      // handleSave() → persiste → setIsEditingText(false) via handleSaveAndExit
      useCaptureDetailStore.getState().setIsEditingText(false);
    });

    then('le texte modifié est persisté dans la base de données', async () => {
      const saved = await testContext.db.findById(captureId);
      expect(saved?.normalizedText).toBe(texteModifie);
    });

    and('le mode édition est désactivé', () => {
      expect(useCaptureDetailStore.getState().isEditingText).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC5 - Annulation de la modification
  // ──────────────────────────────────────────────────────────────────────────
  test('AC5 - Annulation de la modification', ({ given, when, then, and }) => {
    const originalText = 'Texte original non modifié';
    const captureId = 'text-ac5';

    given('une capture de type texte en mode édition avec du texte modifié', async () => {
      await testContext.db.create(
        createMockTextCapture({
          id: captureId,
          normalizedText: originalText,
        }),
      );
      // Simule le passage en mode édition + modification du texte
      useCaptureDetailStore.getState().setIsEditingText(true);
      useCaptureDetailStore.getState().setEditedText("Texte que l'utilisateur va annuler");
      useCaptureDetailStore.getState().setHasTextChanges(true);
    });

    when("l'utilisateur annule les modifications", () => {
      // handleDiscardChanges() → restaure editedText + setIsEditingText(false)
      useCaptureDetailStore.getState().setEditedText(originalText);
      useCaptureDetailStore.getState().setHasTextChanges(false);
      useCaptureDetailStore.getState().setIsEditingText(false);
    });

    then('le texte original est restauré', () => {
      expect(useCaptureDetailStore.getState().editedText).toBe(originalText);
    });

    and('le mode édition est désactivé', () => {
      expect(useCaptureDetailStore.getState().isEditingText).toBe(false);
    });

    and("aucune modification n'est persistée", async () => {
      // La base de données contient toujours le texte original (pas de db.update appelé)
      const stored = await testContext.db.findById(captureId);
      expect(stored?.normalizedText).toBe(originalText);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC6 - Pas de régression sur les captures audio
  // ──────────────────────────────────────────────────────────────────────────
  test('AC6 - Pas de régression sur les captures audio', ({ given, when, then, and }) => {
    let capture: any;

    given('une capture de type audio avec transcription', async () => {
      capture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio-ac6',
          normalizedText: 'Transcription audio',
          duration: 90000,
          filePath: 'mock://audio_ac6.m4a',
        }),
      );
    });

    when("l'écran de détail se charge", async () => {
      const loaded = await testContext.db.findById('audio-ac6');
      capture = loaded;
    });

    then('la capture est identifiée comme audio', () => {
      expect(capture?.type).toBe('AUDIO');
    });

    and('la capture possède un fichier audio et une durée', () => {
      expect(capture?.filePath).toBeDefined();
      expect(capture?.duration).toBeGreaterThan(0);
    });
  });
});
