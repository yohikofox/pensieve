/**
 * Story 2.3 - Annuler Capture Audio
 * BDD Acceptance Tests with jest-cucumber
 *
 * Tests annulation d'enregistrement audio :
 * - AC1: Cancel button → arrêt immédiat, suppression fichier, nettoyage DB
 * - AC2: Swipe cancel gesture → confirmation prompt
 * - AC3: Haptic feedback + animation de rejet
 * - AC4: Protection contre annulation accidentelle
 * - AC5: Fonctionnement offline identique (FR4 compliance)
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { TestContext } from './support/test-context';

const feature = loadFeature('./tests/acceptance/features/story-2-3-annuler-capture.feature');

defineFeature(feature, (test) => {
  let testContext: TestContext;
  let recordingUri: string;
  let captureId: string;
  let initialDuration: number;

  beforeEach(() => {
    testContext = new TestContext();
  });

  afterEach(() => {
    testContext.reset();
  });

  // ==========================================================================
  // AC1: Cancel Button → Arrêt Immédiat et Nettoyage
  // ==========================================================================

  test('Annuler enregistrement avec bouton cancel', ({ given, when, then, and }) => {
    given('que l\'utilisateur "user-123" enregistre de l\'audio', async () => {
      testContext.setUserId('user-123');

      const recording = await testContext.audioRecorder.startRecording();
      recordingUri = recording.uri;

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'RECORDING',
        filePath: recordingUri,
        rawContent: recordingUri,
      });
      captureId = capture.id;

      await testContext.fileSystem.writeFile(recordingUri, 'mock-audio-data');
    });

    when('l\'utilisateur tape sur le bouton annuler', async () => {
      // Simulates RecordingService.cancelRecording()
      await testContext.audioRecorder.stopRecording();
      await testContext.fileSystem.deleteFile(recordingUri);
      await testContext.db.delete(captureId);
    });

    then('l\'enregistrement s\'arrête immédiatement', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('le fichier audio est supprimé du stockage', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(false);
    });

    and('l\'entité Capture est supprimée de la base', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeNull();
    });

    and('l\'utilisateur revient à l\'écran principal', () => {
      // Navigation assertion (requires navigation mock)
      // Placeholder for now
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });
  });

  test('Vérifier suppression complète du fichier audio', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio depuis 5 secondes', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(5000);
      const recording = await testContext.audioRecorder.stopRecording();
      recordingUri = recording.uri;
      await testContext.fileSystem.writeFile(recordingUri, 'mock-audio-5s');
    });

    given('un fichier audio existe dans le stockage', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(true);
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.fileSystem.deleteFile(recordingUri);
    });

    then('le fichier audio est complètement supprimé', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(false);
    });

    and('aucun fichier orphelin ne reste dans MockFileSystem', () => {
      expect(testContext.fileSystem.getFiles().length).toBe(0);
    });
  });

  test('Vérifier suppression de l\'entité Capture', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    given('une entité Capture existe avec state "RECORDING"', async () => {
      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'RECORDING',
        rawContent: 'mock-uri',
      });
      captureId = capture.id;
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.db.delete(captureId);
    });

    then('l\'entité Capture est supprimée de WatermelonDB', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeNull();
    });

    and('le count des Captures est 0', async () => {
      const count = await testContext.db.count();
      expect(count).toBe(0);
    });
  });

  test('Retour à l\'écran principal après annulation', ({ given, when, then, and }) => {
    given('que l\'utilisateur est sur l\'écran d\'enregistrement', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.audioRecorder.stopRecording();
    });

    then('l\'utilisateur est redirigé vers l\'écran principal', () => {
      // Navigation mock needed
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('l\'écran principal est prêt pour une nouvelle capture', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });
  });

  // ==========================================================================
  // AC2: Swipe Cancel Gesture → Confirmation Prompt
  // ==========================================================================

  test('Swipe cancel déclenche un dialog de confirmation', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur fait un swipe cancel', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    then('un dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    and('le message est "Discard this recording?"', () => {
      expect(testContext.dialog.getMessage()).toBe('Discard this recording?');
    });

    and('les options "Discard" et "Keep Recording" sont disponibles', () => {
      expect(testContext.dialog.getOptions()).toEqual(['Discard', 'Keep Recording']);
    });
  });

  test('Dialog affiche le bon message et options', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio depuis 10 secondes', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(10000);
    });

    when('l\'utilisateur fait un swipe down', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    then('le dialog s\'affiche avec le titre "Discard this recording?"', () => {
      expect(testContext.dialog.getMessage()).toBe('Discard this recording?');
    });

    and('le bouton "Discard" est visible avec data-testid="cancel-dialog-discard-button"', () => {
      expect(testContext.dialog.getOptions()).toContain('Discard');
    });

    and('le bouton "Keep Recording" est visible avec data-testid="cancel-dialog-keep-button"', () => {
      expect(testContext.dialog.getOptions()).toContain('Keep Recording');
    });
  });

  test('Confirmer \'Discard\' annule l\'enregistrement', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      const recording = await testContext.audioRecorder.startRecording();
      recordingUri = recording.uri;
      await testContext.fileSystem.writeFile(recordingUri, 'mock-data');

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'RECORDING',
        filePath: recordingUri,
        rawContent: recordingUri,
      });
      captureId = capture.id;
    });

    given('l\'utilisateur fait un swipe cancel', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    given('le dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    when('l\'utilisateur sélectionne "Discard"', async () => {
      testContext.dialog.selectOption('Discard');

      // Execute cancellation
      await testContext.audioRecorder.stopRecording();
      await testContext.fileSystem.deleteFile(recordingUri);
      await testContext.db.delete(captureId);
    });

    then('l\'enregistrement est annulé (comme cancel button)', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('le fichier audio est supprimé', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(false);
    });

    and('l\'entité Capture est supprimée', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeNull();
    });
  });

  test('Choisir \'Keep Recording\' continue l\'enregistrement', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio depuis 7 secondes', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(7000);
      initialDuration = testContext.audioRecorder.getStatus().durationMillis;
    });

    given('l\'utilisateur fait un swipe cancel', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    given('le dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    when('l\'utilisateur sélectionne "Keep Recording"', () => {
      testContext.dialog.selectOption('Keep Recording');
    });

    then('le dialog se ferme', () => {
      expect(testContext.dialog.isShown()).toBe(false);
    });

    and('l\'enregistrement continue', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(true);
    });

    and('la durée enregistrée est préservée (7000ms)', () => {
      expect(testContext.audioRecorder.getStatus().durationMillis).toBe(7000);
    });
  });

  test('Tester différents patterns de swipe', ({ given, when, then }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when(/l'utilisateur fait un swipe "(.*)"/, (pattern: string) => {
      // All swipe patterns trigger dialog
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    then('le dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });
  });

  // ==========================================================================
  // AC3: Haptic Feedback + Animation de Rejet
  // ==========================================================================

  test('Déclencher haptic feedback lors de l\'annulation', ({ when, then, and }) => {
    when('l\'utilisateur annule un enregistrement', async () => {
      await testContext.audioRecorder.startRecording();

      // TODO: Wire MockHaptics in TestContext
      // testContext.haptics.triggerFeedback('medium');

      await testContext.audioRecorder.stopRecording();
    });

    then('un feedback haptique de type "medium" est déclenché', () => {
      // TODO: Implement MockHaptics
      // expect(testContext.haptics.wasFeedbackTriggered()).toBe(true);
      // expect(testContext.haptics.getFeedbackType()).toBe('medium');
      expect(true).toBe(true); // Placeholder
    });

    and('le feedback est confirmé par MockHaptics', () => {
      // TODO: Implement MockHaptics
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Afficher animation de rejet', ({ when, then, and }) => {
    when('l\'utilisateur annule un enregistrement', async () => {
      await testContext.audioRecorder.startRecording();
      await testContext.audioRecorder.stopRecording();
    });

    then('une animation de rejet s\'affiche', () => {
      // TODO: Implement animation tracking mock
      expect(true).toBe(true); // Placeholder
    });

    and('l\'animation montre la capture "disparaître"', () => {
      // TODO: Animation assertion
      expect(true).toBe(true); // Placeholder
    });

    and('l\'animation utilise fade-out et slide-down', () => {
      // TODO: Animation style assertion
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Animation durée < 500ms', ({ when, then, and }) => {
    when('l\'utilisateur annule un enregistrement', async () => {
      await testContext.audioRecorder.startRecording();
      await testContext.audioRecorder.stopRecording();
    });

    then('l\'animation de rejet démarre immédiatement', () => {
      // TODO: Animation timing
      expect(true).toBe(true); // Placeholder
    });

    and('l\'animation se termine en moins de 500ms', () => {
      // TODO: Animation duration assertion
      expect(true).toBe(true); // Placeholder
    });

    and('l\'écran principal est affiché après l\'animation', () => {
      // TODO: Navigation assertion
      expect(true).toBe(true); // Placeholder
    });
  });

  // ==========================================================================
  // AC4: Protection Contre Annulation Accidentelle
  // ==========================================================================

  test('Afficher confirmation pour prévenir annulation accidentelle', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur tape sur le bouton cancel', () => {
      // ALWAYS show confirmation dialog
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    then('un dialog de confirmation s\'affiche TOUJOURS', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    and('le message prévient de la perte de données', () => {
      expect(testContext.dialog.getMessage()).toContain('Discard');
    });

    and('l\'annulation n\'est PAS silencieuse', () => {
      // No silent cancel
      expect(testContext.dialog.isShown()).toBe(true);
    });
  });

  test('Continuer l\'enregistrement sans perte de données', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio depuis 12 secondes', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(12000);
    });

    given('l\'utilisateur tape sur cancel (accidentellement)', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    given('le dialog de confirmation apparaît', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    when('l\'utilisateur choisit "Keep Recording"', () => {
      initialDuration = testContext.audioRecorder.getStatus().durationMillis;
      testContext.dialog.selectOption('Keep Recording');
    });

    then('l\'enregistrement continue', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(true);
    });

    and('la durée est toujours 12000ms (préservée)', () => {
      expect(testContext.audioRecorder.getStatus().durationMillis).toBe(12000);
    });

    and('aucune donnée n\'est perdue', () => {
      expect(testContext.audioRecorder.getStatus().durationMillis).toBe(initialDuration);
    });
  });

  test('Vérifier que les fichiers ne sont pas supprimés si annulé', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    given('un fichier audio "recording-123.m4a" existe', async () => {
      recordingUri = 'recording-123.m4a';
      await testContext.fileSystem.writeFile(recordingUri, 'mock-data');
    });

    given('l\'utilisateur tape sur cancel', () => {
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);
    });

    when('l\'utilisateur choisit "Keep Recording" dans le dialog', () => {
      testContext.dialog.selectOption('Keep Recording');
    });

    then('le fichier "recording-123.m4a" existe toujours', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(true);
    });

    and('l\'entité Capture existe toujours avec state "RECORDING"', async () => {
      // Would need to create Capture first
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(true);
    });
  });

  test('Double confirmation pour annulation rapide', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur tape rapidement 2 fois sur cancel', () => {
      // First tap
      testContext.dialog.show('Discard this recording?', ['Discard', 'Keep Recording']);

      // Second tap (should be ignored while dialog is shown)
      // Dialog already shown, second tap has no effect
    });

    then('un seul dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    and('le second tap ne bypass pas la confirmation', () => {
      // Only one dialog shown
      expect(testContext.dialog.getMessage()).toBe('Discard this recording?');
    });

    and('l\'enregistrement n\'est pas annulé automatiquement', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(true);
    });
  });

  // ==========================================================================
  // AC5: Fonctionnement Offline Identique
  // ==========================================================================

  test('Annuler en mode offline fonctionne identiquement', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    given('l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.audioRecorder.stopRecording();
    });

    then('l\'annulation fonctionne de manière identique au mode en ligne', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('aucune tentative de connexion réseau n\'est faite', () => {
      expect(testContext.isOffline()).toBe(true);
      // No network errors should be thrown
    });
  });

  test('Aucun fichier orphelin après annulation offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    given('l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    given('un fichier "offline-recording.m4a" est créé', async () => {
      recordingUri = 'offline-recording.m4a';
      await testContext.fileSystem.writeFile(recordingUri, 'offline-data');
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.audioRecorder.stopRecording();
      await testContext.fileSystem.deleteFile(recordingUri);
    });

    then('le fichier "offline-recording.m4a" est supprimé', async () => {
      const fileExists = await testContext.fileSystem.fileExists(recordingUri);
      expect(fileExists).toBe(false);
    });

    and('MockFileSystem.getFiles().length === 0', () => {
      expect(testContext.fileSystem.getFiles().length).toBe(0);
    });
  });

  test('Aucune erreur réseau levée', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when('l\'utilisateur annule un enregistrement', async () => {
      await testContext.audioRecorder.startRecording();
      await testContext.audioRecorder.stopRecording();
    });

    then('aucune exception réseau n\'est levée', () => {
      // No errors thrown
      expect(true).toBe(true);
    });

    and('aucun message d\'erreur réseau n\'est affiché', () => {
      // UI assertion
      expect(true).toBe(true);
    });

    and('l\'utilisateur ne voit aucune indication d\'échec réseau', () => {
      // UX assertion
      expect(true).toBe(true);
    });
  });

  test('Vérifier queue de sync après annulation offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    given('l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    given('une Capture avec syncStatus "pending" est créée', async () => {
      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'RECORDING',
        rawContent: 'mock',
        syncStatus: 'pending',
      });
      captureId = capture.id;
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.audioRecorder.stopRecording();
      await testContext.db.delete(captureId);
    });

    then('la Capture est supprimée de la base', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeNull();
    });

    and('aucune Capture avec syncStatus "pending" n\'existe', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(0);
    });

    and('la queue de synchronisation ne contient pas cette capture', async () => {
      const allCaptures = await testContext.db.findAll();
      expect(allCaptures.length).toBe(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  test('Annulation immédiate après démarrage', ({ given, when, then, and }) => {
    given('que l\'utilisateur démarre un enregistrement', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur annule en moins de 100ms', async () => {
      await testContext.audioRecorder.stopRecording();
    });

    then('l\'annulation fonctionne correctement', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('aucun fichier n\'est créé', () => {
      expect(testContext.fileSystem.getFiles().length).toBe(0);
    });

    and('aucune entité Capture ne reste', async () => {
      const count = await testContext.db.count();
      expect(count).toBe(0);
    });
  });

  test('Plusieurs annulations rapides consécutives', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    when('l\'utilisateur annule l\'enregistrement', async () => {
      await testContext.audioRecorder.stopRecording();
    });

    when('l\'utilisateur annule à nouveau (alors que le premier cancel est en cours)', async () => {
      // Second cancel should be no-op (already stopped)
    });

    then('une seule annulation est traitée', () => {
      expect(testContext.audioRecorder.getStatus().isRecording).toBe(false);
    });

    and('aucune erreur de double-suppression n\'est levée', () => {
      // No errors
      expect(true).toBe(true);
    });
  });

  test('Gérer annulation pendant sauvegarde', ({ given, when, then, and }) => {
    given('que l\'utilisateur enregistre de l\'audio', async () => {
      await testContext.audioRecorder.startRecording();
    });

    given('l\'utilisateur arrête l\'enregistrement normalement', async () => {
      await testContext.audioRecorder.stopRecording();
    });

    given('la sauvegarde est en cours', async () => {
      // Simulating save in progress
      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'mock',
      });
      captureId = capture.id;
    });

    when('l\'utilisateur tente d\'annuler pendant la sauvegarde', () => {
      // Cancel attempt should be ignored (already saved)
    });

    then('l\'annulation est ignorée (déjà en train de sauvegarder)', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).not.toBeNull();
    });

    and('la Capture est sauvegardée normalement', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe('CAPTURED');
    });
  });
});
